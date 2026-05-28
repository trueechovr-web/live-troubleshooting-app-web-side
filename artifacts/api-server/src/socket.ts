import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { pointToEventsTable, sessionsTable, headsetsTable, qrCodesTable, qrDictionaryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// RTC types are DOM-only; declare minimal shapes for Node.js context
interface RTCSessionDescriptionInit { type: string; sdp?: string }
interface RTCIceCandidateInit { candidate?: string; sdpMLineIndex?: number | null; sdpMid?: string | null; usernameFragment?: string | null }

interface RoomPeer {
  socketId: string;
  role: "admin" | "tech" | "headset";
  locationId?: string;
}

const rooms = new Map<string, RoomPeer[]>();

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io/",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join-room", ({ roomCode, role, locationId }: { roomCode: string; role: "admin" | "tech" | "headset"; locationId?: string }) => {
      if (!roomCode || !role) return;

      const peers = rooms.get(roomCode) ?? [];
      const existing = peers.find((p) => p.role === role);
      if (existing) {
        existing.socketId = socket.id;
        if (locationId) existing.locationId = locationId;
      } else {
        peers.push({ socketId: socket.id, role, locationId });
      }
      rooms.set(roomCode, peers);

      socket.join(roomCode);
      logger.info({ roomCode, role, socketId: socket.id, locationId }, "Peer joined room");

      socket.to(roomCode).emit("peer-joined", { role, socketId: socket.id });
      socket.emit("room-peers", peers.filter((p) => p.socketId !== socket.id));
    });

    socket.on("offer", ({ roomCode, offer, targetRole }: { roomCode: string; offer: RTCSessionDescriptionInit; targetRole: string }) => {
      const peers = rooms.get(roomCode) ?? [];
      const target = peers.find((p) => p.role === targetRole);
      if (target) {
        io.to(target.socketId).emit("offer", { offer, fromSocketId: socket.id });
      }
    });

    socket.on("answer", ({ roomCode, answer, targetSocketId }: { roomCode: string; answer: RTCSessionDescriptionInit; targetSocketId: string }) => {
      io.to(targetSocketId).emit("answer", { answer });
    });

    socket.on("ice-candidate", ({ roomCode, candidate, targetSocketId }: { roomCode: string; candidate: RTCIceCandidateInit; targetSocketId: string }) => {
      io.to(targetSocketId).emit("ice-candidate", { candidate });
    });

    socket.on("chat-message", ({ roomCode, message, senderRole }: { roomCode: string; message: string; senderRole: string }) => {
      socket.to(roomCode).emit("chat-message", { message, senderRole, timestamp: new Date().toISOString() });
    });

    socket.on("battery-update", ({ roomCode, batteryLevel }: { roomCode: string; batteryLevel: number }) => {
      if (typeof batteryLevel !== "number" || batteryLevel < 0 || batteryLevel > 100) return;
      const peers = rooms.get(roomCode) ?? [];
      const sender = peers.find((p) => p.socketId === socket.id);
      if (!sender || sender.role !== "headset") return;
      db.select({ headsetId: sessionsTable.headsetId })
        .from(sessionsTable)
        .where(eq(sessionsTable.roomCode, roomCode))
        .then(([session]) => {
          if (!session) return;
          return db.update(headsetsTable)
            .set({ batteryLevel, lastSeen: new Date() })
            .where(eq(headsetsTable.id, session.headsetId))
            .then(() => {
              socket.to(roomCode).emit("battery-update", { batteryLevel });
            });
        })
        .catch((err) => logger.error({ err }, "Failed to process battery update"));
    });

    socket.on("point-to", ({ roomCode, objectName }: { roomCode: string; objectName: string }) => {
      const peers = rooms.get(roomCode) ?? [];
      const headset = peers.find((p) => p.role === "headset");
      const locationId = headset?.locationId;

      const persistPointTo = (sessionId: string) => {
        db.insert(pointToEventsTable)
          .values({ id: randomUUID(), sessionId, objectName })
          .catch((err) => logger.error({ err }, "Failed to persist point-to event"));
      };

      const lookupSession = () =>
        db.select({ id: sessionsTable.id })
          .from(sessionsTable)
          .where(eq(sessionsTable.roomCode, roomCode))
          .then(([session]) => { if (session) persistPointTo(session.id); })
          .catch((err) => logger.error({ err }, "Failed to look up session for point-to event"));

      if (!locationId || !objectName) {
        socket.to(roomCode).emit("point-to", { name: objectName });
        if (objectName) lookupSession();
        return;
      }

      db.select({
        qrValue: qrCodesTable.qrValue,
        posX: qrCodesTable.posX,
        posY: qrCodesTable.posY,
        posZ: qrCodesTable.posZ,
        rotX: qrCodesTable.rotX,
        rotY: qrCodesTable.rotY,
        rotZ: qrCodesTable.rotZ,
        rotW: qrCodesTable.rotW,
      })
        .from(qrCodesTable)
        .innerJoin(qrDictionaryTable, eq(qrCodesTable.qrValue, qrDictionaryTable.qrValue))
        .where(
          and(
            eq(qrCodesTable.locationId, locationId),
            eq(qrDictionaryTable.name, objectName),
          )
        )
        .limit(1)
        .then(([row]) => {
          if (row) {
            socket.to(roomCode).emit("point-to", {
              name: objectName,
              qrCode: row.qrValue,
              pose: {
                position: { x: row.posX, y: row.posY, z: row.posZ },
                rotation: { x: row.rotX, y: row.rotY, z: row.rotZ, w: row.rotW },
              },
            });
          } else {
            socket.to(roomCode).emit("point-to", { name: objectName });
          }
          lookupSession();
        })
        .catch((err) => {
          logger.error({ err }, "Failed to look up point-to spatial data — falling back");
          socket.to(roomCode).emit("point-to", { name: objectName });
          lookupSession();
        });
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
      rooms.forEach((peers, roomCode) => {
        const updated = peers.filter((p) => p.socketId !== socket.id);
        if (updated.length === 0) {
          rooms.delete(roomCode);
        } else {
          rooms.set(roomCode, updated);
          io.to(roomCode).emit("peer-left", { socketId: socket.id });
        }
      });
    });
  });

  return io;
}
