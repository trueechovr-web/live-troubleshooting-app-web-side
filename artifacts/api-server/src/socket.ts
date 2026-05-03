import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { pointToEventsTable, sessionsTable, headsetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

interface RoomPeer {
  socketId: string;
  role: "admin" | "tech" | "headset";
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

    socket.on("join-room", ({ roomCode, role }: { roomCode: string; role: "admin" | "tech" | "headset" }) => {
      if (!roomCode || !role) return;

      const peers = rooms.get(roomCode) ?? [];
      const existing = peers.find((p) => p.role === role);
      if (existing) {
        existing.socketId = socket.id;
      } else {
        peers.push({ socketId: socket.id, role });
      }
      rooms.set(roomCode, peers);

      socket.join(roomCode);
      logger.info({ roomCode, role, socketId: socket.id }, "Peer joined room");

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
      // Only the headset peer in this room may send battery updates
      const peers = rooms.get(roomCode) ?? [];
      const sender = peers.find((p) => p.socketId === socket.id);
      if (!sender || sender.role !== "headset") return;
      // Persist first, then broadcast to other peers on success
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
      socket.to(roomCode).emit("point-to", { objectName });
      if (objectName) {
        db.select({ id: sessionsTable.id })
          .from(sessionsTable)
          .where(eq(sessionsTable.roomCode, roomCode))
          .then(([session]) => {
            if (session) {
              db.insert(pointToEventsTable)
                .values({ id: randomUUID(), sessionId: session.id, objectName })
                .catch((err) => logger.error({ err }, "Failed to persist point-to event"));
            }
          })
          .catch((err) => logger.error({ err }, "Failed to look up session for point-to event"));
      }
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
