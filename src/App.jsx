import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "https://serviceA12M23.doobot.ai";

export default function App() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    base_prompt: "",
    initial_message: "",
    activate_after_create: false,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    base_prompt: "",
    initial_message: "",
  });

  const sortedPrompts = useMemo(() => {
    return [...prompts].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedPrompts;
    return sortedPrompts.filter((p) =>
      (p.name || "").toLowerCase().includes(q)
    );
  }, [sortedPrompts, query]);

  const selectedPrompt = useMemo(() => {
    if (!filteredPrompts.length && !sortedPrompts.length) return null;

    return (
      sortedPrompts.find((p) => p.id === selectedPromptId) ||
      filteredPrompts[0] ||
      sortedPrompts[0] ||
      null
    );
  }, [filteredPrompts, sortedPrompts, selectedPromptId]);

  async function loadPrompts() {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/prompts`);
      if (!resp.ok) {
        throw new Error(`Error al cargar prompts (${resp.status})`);
      }
      const data = await resp.json();
      setPrompts(data);

      if (data.length && !selectedPromptId) {
        const latest = [...data].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0];
        setSelectedPromptId(latest.id);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar los prompts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    if (
      selectedPromptId &&
      !sortedPrompts.some((p) => p.id === selectedPromptId)
    ) {
      setSelectedPromptId(sortedPrompts[0]?.id ?? null);
    }
  }, [sortedPrompts, selectedPromptId]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateEditForm(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEditing(prompt) {
    setEditingId(prompt.id);
    setEditForm({
      name: prompt.name || "",
      base_prompt: prompt.base_prompt || "",
      initial_message: prompt.initial_message || "",
    });
    setError("");
    setSuccess("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({
      name: "",
      base_prompt: "",
      initial_message: "",
    });
  }

  async function handleCreatePrompt(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Debes indicar un nombre para el prompt.");
      return;
    }

    if (!form.initial_message.trim()) {
      setError("Debes indicar el saludo inicial del agente.");
      return;
    }

    if (!form.base_prompt.trim()) {
      setError("Debes pegar el texto del prompt.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        base_prompt: form.base_prompt,
        initial_message: form.initial_message.trim(),
      };

      console.log("PAYLOAD CREATE", payload);

      const createResp = await fetch(`${API_BASE}/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!createResp.ok) {
        const msg = await safeReadError(createResp);
        throw new Error(msg || `Error al guardar (${createResp.status})`);
      }

      const created = await createResp.json();
      console.log("CREATED PROMPT RESPONSE", created);

      if (form.activate_after_create) {
        const activateResp = await fetch(
          `${API_BASE}/prompts/${created.id}/activate`,
          {
            method: "POST",
          }
        );

        if (!activateResp.ok) {
          const msg = await safeReadError(activateResp);
          throw new Error(
            msg || `Se guardó, pero no se pudo activar (${activateResp.status})`
          );
        }
      }

      setForm({
        name: "",
        base_prompt: "",
        initial_message: "",
        activate_after_create: false,
      });

      setSuccess(
        form.activate_after_create
          ? "Prompt guardado y activado."
          : "Prompt guardado correctamente."
      );

      await loadPrompts();
      setSelectedPromptId(created.id);
    } catch (err) {
      setError(err.message || "No se pudo guardar el prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePrompt(e) {
    e.preventDefault();

    if (!selectedPrompt) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      if (!editForm.name.trim()) {
        throw new Error("Debes indicar un nombre para el prompt.");
      }

      if (!editForm.initial_message.trim()) {
        throw new Error("Debes indicar el saludo inicial del agente.");
      }

      if (!editForm.base_prompt.trim()) {
        throw new Error("Debes indicar el texto del prompt.");
      }

      const payload = {
        name: editForm.name.trim(),
        base_prompt: editForm.base_prompt,
        initial_message: editForm.initial_message.trim(),
      };

      console.log("PAYLOAD UPDATE", payload);

      const resp = await fetch(`${API_BASE}/prompts/${selectedPrompt.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const msg = await safeReadError(resp);
        throw new Error(msg || `No se pudo actualizar (${resp.status})`);
      }

      const updated = await resp.json();
      console.log("UPDATED PROMPT RESPONSE", updated);

      await loadPrompts();
      setSuccess("Prompt actualizado correctamente.");
      setEditingId(null);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(promptId) {
    setActivatingId(promptId);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch(`${API_BASE}/prompts/${promptId}/activate`, {
        method: "POST",
      });

      if (!resp.ok) {
        const msg = await safeReadError(resp);
        throw new Error(msg || `No se pudo activar (${resp.status})`);
      }

      setSuccess("Prompt activado correctamente.");
      await loadPrompts();
      setSelectedPromptId(promptId);
    } catch (err) {
      setError(err.message || "No se pudo activar el prompt");
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDelete(prompt) {
    const ok = window.confirm(
      `¿Estás seguro de que quieres eliminar este Prompt? No podrá recuperarse.\n\n${prompt.name}`
    );
    if (!ok) return;

    setDeletingId(prompt.id);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch(`${API_BASE}/prompts/${prompt.id}`, {
        method: "DELETE",
      });

      if (!resp.ok) {
        const msg = await safeReadError(resp);
        throw new Error(msg || `No se pudo eliminar (${resp.status})`);
      }

      setSuccess("Prompt eliminado correctamente.");
      await loadPrompts();

      if (selectedPromptId === prompt.id) {
        setSelectedPromptId(null);
      }
    } catch (err) {
      setError(err.message || "No se pudo eliminar el prompt");
    } finally {
      setDeletingId(null);
    }
  }

  const isNarrow =
    typeof window !== "undefined" && window.innerWidth < 1100;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.phoneBanner}>
          <span>Teléfono para probar simulación:</span>
          <span style={{ fontWeight: 800 }}>911674759</span>
        </div>

        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Prompt Manager</div>
            <h1 style={styles.title}>Gestión de prompts del agente de voz</h1>
            <p style={styles.subtitle}>
              Crea, revisa, activa, edita y elimina prompts de forma visual.
            </p>
          </div>

          <div style={styles.stats}>
            <div>
              <div style={styles.statLabel}>Prompts totales</div>
              <div style={styles.statValue}>{sortedPrompts.length}</div>
            </div>
            <div>
              <div style={styles.statLabel}>Activo</div>
              <div style={{ ...styles.statValue, color: "#059669" }}>
                {sortedPrompts.filter((p) => p.is_active).length}
              </div>
            </div>
          </div>
        </div>

        {(error || success) && (
          <div style={{ marginBottom: 24 }}>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}
          </div>
        )}

        <div
          style={{
            ...styles.mainGrid,
            gridTemplateColumns: isNarrow ? "1fr" : "420px minmax(0, 1fr)",
          }}
        >
          <section style={styles.leftPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Listado de prompts</h2>
                <p style={styles.sectionText}>
                  Se muestra solo el nombre. Selecciona uno para ver o editar.
                </p>
              </div>

              <button onClick={loadPrompts} style={styles.secondaryButton}>
                Recargar
              </button>
            </div>

            <div style={styles.searchRow}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre..."
                style={styles.input}
              />
            </div>

            {loading ? (
              <div style={styles.placeholder}>Cargando prompts...</div>
            ) : filteredPrompts.length === 0 ? (
              <div style={styles.placeholder}>
                No hay prompts que coincidan con la búsqueda.
              </div>
            ) : (
              <div style={styles.listScroller}>
                {filteredPrompts.map((prompt) => {
                  const selected = selectedPrompt?.id === prompt.id;

                  return (
                    <article
                      key={prompt.id}
                      onClick={() => setSelectedPromptId(prompt.id)}
                      style={{
                        ...styles.listItem,
                        ...(selected ? styles.listItemSelected : {}),
                      }}
                    >
                      <div style={styles.listItemTop}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={styles.listNameRow}>
                            <h3 style={styles.listName}>{prompt.name}</h3>
                            {prompt.is_active && (
                              <span style={styles.activeBadge}>Activo</span>
                            )}
                          </div>

                          <div style={styles.promptMeta}>
                            ID {prompt.id} · {formatDate(prompt.created_at)}
                          </div>
                        </div>
                      </div>

                      <div style={styles.listActions}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivate(prompt.id);
                          }}
                          disabled={
                            prompt.is_active || activatingId === prompt.id
                          }
                          style={{
                            ...styles.primaryButtonSmall,
                            ...(prompt.is_active ? styles.activeButton : {}),
                          }}
                        >
                          {prompt.is_active
                            ? "Activo"
                            : activatingId === prompt.id
                            ? "Activando..."
                            : "Activar"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPromptId(prompt.id);
                            startEditing(prompt);
                          }}
                          style={styles.secondaryButtonSmall}
                        >
                          Editar
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(prompt);
                          }}
                          disabled={deletingId === prompt.id}
                          style={styles.deleteButton}
                        >
                          {deletingId === prompt.id ? "Borrando..." : "Borrar"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section style={styles.rightColumn}>
            <section style={styles.cardStrong}>
              <div style={styles.sectionHeaderSimple}>
                <h2 style={styles.sectionTitle}>Detalle del prompt</h2>
                <p style={styles.sectionText}>
                  Aquí se visualiza el contenido completo del prompt seleccionado.
                </p>
              </div>

              {selectedPrompt ? (
                <div>
                  <div style={styles.promptTitleRow}>
                    <h3 style={styles.detailTitle}>{selectedPrompt.name}</h3>
                    {selectedPrompt.is_active && (
                      <span style={styles.activeBadge}>Activo</span>
                    )}
                  </div>

                  <div style={styles.promptMeta}>
                    ID {selectedPrompt.id} · {formatDate(selectedPrompt.created_at)}
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div style={styles.label}>Saludo inicial</div>
                    <div style={styles.detailBoxSmall}>
                      {selectedPrompt.initial_message &&
                      selectedPrompt.initial_message.trim()
                        ? selectedPrompt.initial_message
                        : "—"}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div style={styles.label}>Texto completo del prompt</div>
                    <div style={styles.detailBox}>{selectedPrompt.base_prompt}</div>
                  </div>
                </div>
              ) : (
                <div style={styles.placeholder}>
                  Selecciona un prompt para ver el detalle.
                </div>
              )}
            </section>

            {editingId && selectedPrompt?.id === editingId ? (
              <section style={styles.cardStrong}>
                <div style={styles.sectionHeaderSimple}>
                  <h2 style={styles.sectionTitle}>Editar prompt</h2>
                  <p style={styles.sectionText}>
                    Modifica nombre, saludo inicial y texto completo.
                  </p>
                </div>

                <form
                  onSubmit={handleUpdatePrompt}
                  style={{ display: "grid", gap: 18 }}
                >
                  <div>
                    <label style={styles.label}>Nombre del prompt</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => updateEditForm("name", e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Saludo inicial del agente</label>
                    <input
                      type="text"
                      value={editForm.initial_message}
                      onChange={(e) =>
                        updateEditForm("initial_message", e.target.value)
                      }
                      placeholder="Ej. Sí, dime."
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Texto completo del prompt</label>
                    <textarea
                      rows={14}
                      value={editForm.base_prompt}
                      onChange={(e) =>
                        updateEditForm("base_prompt", e.target.value)
                      }
                      style={styles.textarea}
                    />
                  </div>

                  <div style={styles.formFooter}>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      style={styles.secondaryButton}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      style={styles.primaryButton}
                    >
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section style={styles.cardStrong}>
                <div style={styles.sectionHeaderSimple}>
                  <h2 style={styles.sectionTitle}>Crear nuevo prompt</h2>
                  <p style={styles.sectionText}>
                    Pega aquí el prompt completo y guárdalo en la base de datos.
                  </p>
                </div>

                <form
                  onSubmit={handleCreatePrompt}
                  style={{ display: "grid", gap: 18 }}
                >
                  <div>
                    <label style={styles.label}>Nombre del prompt</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      placeholder="Ej. Miguel agradecido por ascenso"
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Saludo inicial del agente</label>
                    <input
                      type="text"
                      value={form.initial_message}
                      onChange={(e) =>
                        updateForm("initial_message", e.target.value)
                      }
                      placeholder="Ej. Sí, dime."
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Texto completo del prompt</label>
                    <textarea
                      rows={14}
                      value={form.base_prompt}
                      onChange={(e) => updateForm("base_prompt", e.target.value)}
                      placeholder="Pega aquí el prompt completo..."
                      style={styles.textarea}
                    />
                  </div>

                  <div style={styles.formFooter}>
                    <label style={styles.checkboxBox}>
                      <input
                        type="checkbox"
                        checked={form.activate_after_create}
                        onChange={(e) =>
                          updateForm("activate_after_create", e.target.checked)
                        }
                      />
                      <span>Dejar este prompt activo al guardarlo</span>
                    </label>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            name: "",
                            base_prompt: "",
                            initial_message: "",
                            activate_after_create: false,
                          })
                        }
                        style={styles.secondaryButton}
                      >
                        Limpiar
                      </button>

                      <button
                        type="submit"
                        disabled={saving}
                        style={styles.primaryButton}
                      >
                        {saving ? "Guardando..." : "Guardar prompt"}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("es-ES");
  } catch {
    return value;
  }
}

async function safeReadError(resp) {
  try {
    const data = await resp.json();
    return data?.detail || JSON.stringify(data);
  } catch {
    try {
      return await resp.text();
    } catch {
      return "";
    }
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    color: "#0f172a",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  container: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "32px 24px 40px",
    boxSizing: "border-box",
  },

  phoneBanner: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 18,
    flexWrap: "wrap",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-end",
    marginBottom: 28,
    flexWrap: "wrap",
  },

  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.22em",
    color: "#64748b",
    fontWeight: 700,
  },

  title: {
    margin: "8px 0 0 0",
    fontSize: 42,
    lineHeight: 1.1,
    color: "#0f172a",
  },

  subtitle: {
    marginTop: 12,
    maxWidth: 760,
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 16,
  },

  stats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #dbe4f0",
    borderRadius: 24,
    padding: 18,
    minWidth: 240,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  },

  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#64748b",
  },

  statValue: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: 700,
  },

  mainGrid: {
    display: "grid",
    gap: 24,
    alignItems: "start",
  },

  leftPanel: {
    background: "rgba(255,255,255,0.92)",
    borderRadius: 28,
    border: "1px solid #dbe4f0",
    padding: 22,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
    display: "flex",
    flexDirection: "column",
    minHeight: 780,
    minWidth: 0,
    boxSizing: "border-box",
  },

  rightColumn: {
    display: "grid",
    gap: 24,
    minWidth: 0,
    width: "100%",
  },

  cardStrong: {
    background: "rgba(255,255,255,0.96)",
    borderRadius: 28,
    border: "1px solid #dbe4f0",
    padding: 24,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    overflow: "hidden",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 18,
    flexWrap: "wrap",
  },

  sectionHeaderSimple: {
    marginBottom: 18,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 26,
    color: "#0f172a",
  },

  sectionText: {
    marginTop: 8,
    color: "#64748b",
    lineHeight: 1.5,
    fontSize: 14,
  },

  searchRow: {
    marginBottom: 16,
    width: "100%",
    minWidth: 0,
  },

  listScroller: {
    display: "grid",
    gap: 12,
    overflowY: "auto",
    maxHeight: 620,
    paddingRight: 4,
    minWidth: 0,
  },

  listItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    background: "#fff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxSizing: "border-box",
  },

  listItemSelected: {
    border: "1px solid #86efac",
    background: "#f0fdf4",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.08)",
  },

  listItemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  listNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  listName: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.2,
    color: "#0f172a",
    wordBreak: "break-word",
  },

  listActions: {
    display: "flex",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },

  promptTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  detailTitle: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
    wordBreak: "break-word",
  },

  activeBadge: {
    background: "#059669",
    color: "#fff",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
  },

  promptMeta: {
    marginTop: 8,
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  detailBox: {
    marginTop: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 20,
    padding: 18,
    whiteSpace: "pre-wrap",
    lineHeight: 1.65,
    color: "#334155",
    fontSize: 14,
    maxHeight: 420,
    overflowY: "auto",
    overflowX: "auto",
    boxSizing: "border-box",
    width: "100%",
  },

  detailBoxSmall: {
    marginTop: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    color: "#334155",
    fontSize: 14,
    boxSizing: "border-box",
    width: "100%",
  },

  placeholder: {
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 20,
    color: "#64748b",
    fontSize: 14,
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 700,
    color: "#334155",
  },

  input: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid #cbd5e1",
    padding: "14px 16px",
    fontSize: 14,
    outline: "none",
    color: "#0f172a",
    background: "#fff",
    display: "block",
  },

  textarea: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid #cbd5e1",
    padding: "14px 16px",
    fontSize: 14,
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    color: "#0f172a",
    background: "#fff",
    minHeight: 280,
    display: "block",
  },

  formFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "center",
  },

  checkboxBox: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 14,
    color: "#334155",
    background: "#fff",
  },

  primaryButton: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 16,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },

  primaryButtonSmall: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },

  secondaryButton: {
    background: "#fff",
    color: "#334155",
    border: "1px solid #d9e2ec",
    borderRadius: 16,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },

  secondaryButtonSmall: {
    background: "#fff",
    color: "#334155",
    border: "1px solid #d9e2ec",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },

  deleteButton: {
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },

  activeButton: {
    background: "#059669",
    cursor: "default",
  },

  errorBox: {
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 18,
    padding: "14px 16px",
    fontSize: 14,
    marginBottom: 10,
  },

  successBox: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#15803d",
    borderRadius: 18,
    padding: "14px 16px",
    fontSize: 14,
  },
};
