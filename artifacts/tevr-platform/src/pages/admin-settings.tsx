import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  useListCustomers,
  useUpdateCustomerPointToObjects,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import type { PointToItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminSettings() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const customers = useListCustomers();
  const customer = customers.data?.[0];

  const [items, setItems] = useState<PointToItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const dragChild = useRef<{ parent: number; idx: number } | null>(null);
  const dragOverChild = useRef<number | null>(null);
  const [dragOverChildState, setDragOverChildState] = useState<{ parent: number; idx: number } | null>(null);

  useEffect(() => {
    if (customer && !dirty) {
      setItems(customer.pointToObjects ?? []);
    }
  }, [customer, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const updateMutation = useUpdateCustomerPointToObjects();

  const totalCount = useMemo(
    () => items.reduce((sum, it) => sum + 1 + (it.children?.length ?? 0), 0),
    [items],
  );

  const updateItems = (next: PointToItem[]) => {
    setItems(next);
    setDirty(true);
    setSaveMessage("");
  };

  const handleAddItem = () => {
    updateItems([{ label: "" }, ...items]);
  };

  const handleAddSubmenu = () => {
    updateItems([{ label: "", children: [{ label: "" }] }, ...items]);
  };

  const handleRenameItem = (idx: number, label: string) => {
    updateItems(items.map((it, i) => (i === idx ? { ...it, label } : it)));
  };

  const handleDeleteItem = (idx: number) => {
    updateItems(items.filter((_, i) => i !== idx));
  };

  const handleConvertToSubmenu = (idx: number) => {
    updateItems(
      items.map((it, i) =>
        i === idx ? { ...it, children: it.children ?? [{ label: "" }] } : it,
      ),
    );
  };

  const handleConvertToItem = (idx: number) => {
    updateItems(
      items.map((it, i) => {
        if (i !== idx) return it;
        const { children: _children, ...rest } = it;
        return rest;
      }),
    );
  };

  const handleAddChild = (parentIdx: number) => {
    updateItems(
      items.map((it, i) =>
        i === parentIdx
          ? { ...it, children: [...(it.children ?? []), { label: "" }] }
          : it,
      ),
    );
  };

  const handleRenameChild = (parentIdx: number, childIdx: number, label: string) => {
    updateItems(
      items.map((it, i) =>
        i === parentIdx
          ? {
              ...it,
              children: (it.children ?? []).map((c, ci) =>
                ci === childIdx ? { ...c, label } : c,
              ),
            }
          : it,
      ),
    );
  };

  const handleDeleteChild = (parentIdx: number, childIdx: number) => {
    updateItems(
      items.map((it, i) =>
        i === parentIdx
          ? {
              ...it,
              children: (it.children ?? []).filter((_, ci) => ci !== childIdx),
            }
          : it,
      ),
    );
  };

  const handleDragStart = (idx: number) => {
    dragItem.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOverItem.current = idx;
    setDragOverIdx(idx);
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const next = [...items];
    const [removed] = next.splice(dragItem.current, 1);
    next.splice(dragOverItem.current, 0, removed);
    dragItem.current = null;
    dragOverItem.current = null;
    updateItems(next);
  };

  const handleChildDragStart = (parent: number, idx: number) => {
    dragChild.current = { parent, idx };
  };

  const handleChildDragEnter = (parent: number, idx: number) => {
    dragOverChild.current = idx;
    setDragOverChildState({ parent, idx });
  };

  const handleChildDragEnd = (parent: number) => {
    setDragOverChildState(null);
    if (!dragChild.current || dragOverChild.current === null) return;
    if (dragChild.current.parent !== parent || dragChild.current.idx === dragOverChild.current) {
      dragChild.current = null;
      dragOverChild.current = null;
      return;
    }
    const next = [...items];
    const children = [...(next[parent].children ?? [])];
    const [removed] = children.splice(dragChild.current.idx, 1);
    children.splice(dragOverChild.current, 0, removed);
    next[parent] = { ...next[parent], children };
    dragChild.current = null;
    dragOverChild.current = null;
    updateItems(next);
  };

  const handleSave = () => {
    if (!customer) return;
    const cleaned: PointToItem[] = items
      .map((it) => {
        const label = it.label.trim();
        if (!label) return null;
        if (it.children) {
          const cleanChildren = it.children
            .map((c) => ({ label: c.label.trim() }))
            .filter((c) => c.label.length > 0);
          return cleanChildren.length > 0
            ? { label, children: cleanChildren }
            : { label };
        }
        return { label };
      })
      .filter((it): it is PointToItem => it !== null);

    const allLabels: string[] = [];
    for (const it of cleaned) {
      allLabels.push(it.label.toLowerCase());
      for (const c of it.children ?? []) allLabels.push(c.label.toLowerCase());
    }
    const dupe = allLabels.find((l, i) => allLabels.indexOf(l) !== i);
    if (dupe) {
      setSaveMessage(`Duplicate label: "${dupe}"`);
      return;
    }

    updateMutation.mutate(
      { customerId: customer.id, data: cleaned },
      {
        onSuccess: () => {
          setItems(cleaned);
          setDirty(false);
          setSaveMessage("Saved");
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(customer.id) });
          setTimeout(() => setSaveMessage(""), 2500);
        },
        onError: () => setSaveMessage("Failed to save"),
      },
    );
  };

  const handleReset = () => {
    if (customer) {
      setItems(customer.pointToObjects ?? []);
      setDirty(false);
      setSaveMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-admin"
            onClick={() => setLocation("/admin")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Account Settings</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-1">Point-to Object Menu</h1>
          <p className="text-sm text-muted-foreground">
            Configure the list of objects an admin can highlight to a technician during a live
            session. Group related items into submenus for easier navigation.
          </p>
        </div>

        {customers.isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !customer ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No customer account found.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalCount} {totalCount === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    data-testid="add-item"
                    onClick={handleAddItem}
                    className="text-sm px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
                  >
                    + Add item
                  </button>
                  <button
                    data-testid="add-submenu"
                    onClick={handleAddSubmenu}
                    className="text-sm px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
                  >
                    + Add submenu
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No items yet. Add an item or submenu above.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {items.map((item, idx) => {
                    const isSubmenu = item.children !== undefined;
                    const isDragTarget = dragOverIdx === idx && dragItem.current !== idx;
                    return (
                      <li
                        key={idx}
                        data-testid={`item-${idx}`}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragEnter={() => handleDragEnter(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={handleDragEnd}
                        className={`rounded-lg border bg-background p-3 transition-all cursor-grab active:cursor-grabbing ${
                          isDragTarget
                            ? "border-primary ring-1 ring-primary/30 scale-[1.01]"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 px-0.5" title="Drag to reorder">
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8.5 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-7 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-7 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                            </svg>
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded shrink-0 ${
                              isSubmenu
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isSubmenu ? "Submenu" : "Item"}
                          </span>
                          <input
                            type="text"
                            data-testid={`item-${idx}-label`}
                            value={item.label}
                            placeholder={isSubmenu ? "Submenu name" : "Object name"}
                            onChange={(e) => handleRenameItem(idx, e.target.value)}
                            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          {isSubmenu ? (
                            <button
                              data-testid={`item-${idx}-flatten`}
                              onClick={() => handleConvertToItem(idx)}
                              title="Convert to plain item"
                              className="text-xs px-2 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              Flatten
                            </button>
                          ) : (
                            <button
                              data-testid={`item-${idx}-make-submenu`}
                              onClick={() => handleConvertToSubmenu(idx)}
                              title="Convert to submenu"
                              className="text-xs px-2 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              Make submenu
                            </button>
                          )}
                          <button
                            data-testid={`item-${idx}-delete`}
                            onClick={() => handleDeleteItem(idx)}
                            className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete"
                          >
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>

                        {isSubmenu && (
                          <ul className="mt-3 ml-8 flex flex-col gap-2 border-l-2 border-border pl-4">
                            {(item.children ?? []).map((child, ci) => {
                              const isChildTarget =
                                dragOverChildState?.parent === idx &&
                                dragOverChildState?.idx === ci &&
                                dragChild.current?.idx !== ci;
                              return (
                                <li
                                  key={ci}
                                  data-testid={`item-${idx}-child-${ci}`}
                                  draggable
                                  onDragStart={(e) => { e.stopPropagation(); handleChildDragStart(idx, ci); }}
                                  onDragEnter={(e) => { e.stopPropagation(); handleChildDragEnter(idx, ci); }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDragEnd={(e) => { e.stopPropagation(); handleChildDragEnd(idx); }}
                                  className={`flex items-center gap-2 rounded-md p-1 transition-all cursor-grab active:cursor-grabbing ${
                                    isChildTarget ? "ring-1 ring-primary/40 bg-primary/5" : ""
                                  }`}
                                >
                                  <span className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 px-0.5" title="Drag to reorder">
                                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8.5 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-7 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-7 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                    </svg>
                                  </span>
                                  <input
                                    type="text"
                                    data-testid={`item-${idx}-child-${ci}-label`}
                                    value={child.label}
                                    placeholder="Child object"
                                    onChange={(e) => handleRenameChild(idx, ci, e.target.value)}
                                    className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  />
                                  <button
                                    data-testid={`item-${idx}-child-${ci}-delete`}
                                    onClick={() => handleDeleteChild(idx, ci)}
                                    className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Delete"
                                  >
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </li>
                              );
                            })}
                            <button
                              data-testid={`item-${idx}-add-child`}
                              onClick={() => handleAddChild(idx)}
                              className="self-start text-xs px-2 py-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors"
                            >
                              + Add to submenu
                            </button>
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              {saveMessage && (
                <span
                  data-testid="save-message"
                  className={`text-sm font-medium ${
                    saveMessage === "Saved" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {saveMessage}
                </span>
              )}
              <button
                data-testid="reset"
                onClick={handleReset}
                disabled={!dirty || updateMutation.isPending}
                className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Discard changes
              </button>
              <button
                data-testid="save"
                onClick={handleSave}
                disabled={!dirty || updateMutation.isPending}
                className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
