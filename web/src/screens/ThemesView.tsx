import { useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { Theme, ThemeTokens } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import {
  DEFAULT_TOKENS,
  TOKEN_GROUPS,
  downloadJson,
  tokensToCssVars,
  validateImportedTheme,
} from "../lib/theme";
import { useApp } from "../state/AppStore";
import { useToast } from "../state/ToastStore";

const SWATCH_KEYS = ["bg", "surface", "text", "accent", "accent-contrast"];

type Draft = { id?: string; name: string; tokens: ThemeTokens };

function previewStyle(tokens: ThemeTokens): CSSProperties {
  const vars = tokensToCssVars(tokens);
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    style[`--token-${key.slice(2)}`] = value;
  }
  return style as CSSProperties;
}

function colorValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : "#000000";
}

export function ThemesView() {
  const { themes, activeThemeId, saveTheme, deleteTheme, setActiveTheme, attempt } = useApp();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Theme | null>(null);

  const apply = async (id: string) => {
    const ok = await attempt(async () => {
      await setActiveTheme(id);
      return true;
    });
    if (ok) push("已切换主题");
  };

  const openCreate = () => {
    setError("");
    setDraft({ name: "", tokens: { ...DEFAULT_TOKENS } });
  };

  const openEdit = (theme: Theme) => {
    setError("");
    setDraft({
      id: theme.id,
      name: theme.name,
      tokens: { ...DEFAULT_TOKENS, ...theme.tokens },
    });
  };

  const closeEditor = () => {
    if (busy) return;
    setDraft(null);
    setError("");
  };

  const setToken = (key: string, value: string) => {
    setDraft((current) =>
      current ? { ...current, tokens: { ...current.tokens, [key]: value } } : current,
    );
  };

  const submit = async () => {
    if (!draft || busy) return;
    const name = draft.name.trim();
    if (!name) {
      setError("给主题起个名字");
      return;
    }

    setBusy(true);
    setError("");
    const saved = await attempt(() => saveTheme({ id: draft.id, name, tokens: draft.tokens }));
    setBusy(false);
    if (!saved) return;

    push(draft.id ? "主题已更新" : "主题已创建");
    setDraft(null);
    if (!draft.id) {
      await attempt(async () => {
        await setActiveTheme(saved.id);
        return true;
      });
    }
  };

  const exportTheme = (theme: Theme) => {
    downloadJson(`${theme.name}.json`, { name: theme.name, tokens: theme.tokens });
    push("主题已导出");
  };

  const importFile = async (file: File) => {
    try {
      const imported = validateImportedTheme(JSON.parse(await file.text()));
      const saved = await saveTheme({ name: imported.name, tokens: imported.tokens });
      await setActiveTheme(saved.id);
      push(`已导入「${saved.name}」并应用`);
    } catch (failure) {
      push(failure instanceof Error ? failure.message : "主题文件无法解析", "error");
    }
  };

  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void importFile(file);
  };

  const removeTheme = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    const target = pendingDelete;
    const ok = await attempt(async () => {
      await deleteTheme(target.id);
      return true;
    });
    setBusy(false);
    setPendingDelete(null);
    if (ok) push("主题已删除");
  };

  const preview = (tokens: ThemeTokens) => (
    <div className="themepreview" style={previewStyle(tokens)}>
      <div className="themepreview__bar">
        <span className="themepreview__dot" />
        <span className="themepreview__lines">
          <i />
          <i />
        </span>
        <span className="themepreview__pill">播放</span>
      </div>
    </div>
  );

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">外观</h1>
          <p className="view__sub">
            主题由一组颜色与形态变量组成，切换即时生效，并跟随账号保存在服务器。
          </p>
        </div>
        <div className="view__actions">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="upload" size={15} />
            导入主题
          </button>
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Icon name="plus" size={15} />
            新建主题
          </button>
        </div>
      </header>

      <section className="view__section">
        <div className="view__legend">
          <span>全部主题</span>
          <span className="num">{themes.length}</span>
        </div>

        <div className="themegrid">
          {themes.map((theme) => {
            const active = theme.id === activeThemeId;
            return (
              <article
                key={theme.id}
                className="themecard"
                data-active={active ? "true" : "false"}
              >
                <div className="themecard__top">
                  <div>
                    <div className="themecard__name">{theme.name}</div>
                    <div className="themecard__note">
                      {theme.builtin ? "内置主题" : "我的主题"}
                    </div>
                  </div>
                  {active ? <span className="tag">使用中</span> : null}
                </div>

                <div className="swatches">
                  {SWATCH_KEYS.map((key) => (
                    <span
                      key={key}
                      className="swatch"
                      style={{ background: theme.tokens[key] ?? "transparent" }}
                    />
                  ))}
                </div>

                {preview(theme.tokens)}

                <div className="themecard__acts">
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => void apply(theme.id)}
                    disabled={active}
                  >
                    {active ? "正在使用" : "应用"}
                  </button>
                  <button
                    type="button"
                    className="ibtn"
                    onClick={() => exportTheme(theme)}
                    title="导出主题"
                    aria-label={`导出 ${theme.name}`}
                  >
                    <Icon name="download" size={15} />
                  </button>
                  {theme.builtin ? null : (
                    <>
                      <button
                        type="button"
                        className="ibtn"
                        onClick={() => openEdit(theme)}
                        title="编辑主题"
                        aria-label={`编辑 ${theme.name}`}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        type="button"
                        className="ibtn"
                        onClick={() => setPendingDelete(theme)}
                        title="删除主题"
                        aria-label={`删除 ${theme.name}`}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={onPickFile}
      />

      {draft ? (
        <Modal
          title={draft.id ? "编辑主题" : "新建主题"}
          subtitle="颜色写十六进制，圆角与投影直接写 CSS 值。"
          wide
          onClose={closeEditor}
          footer={
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeEditor}
                disabled={busy}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void submit()}
                disabled={busy}
              >
                {busy ? "保存中…" : "保存主题"}
              </button>
            </>
          }
        >
          <div className="formstack">
            <label className="field">
              <span className="field__label">主题名称</span>
              <input
                value={draft.name}
                maxLength={60}
                placeholder="例如：黄昏纸页"
                autoFocus
                onChange={(event) =>
                  setDraft({ ...draft, name: event.currentTarget.value })
                }
              />
            </label>

            {preview(draft.tokens)}

            <div className="tokenlist">
              {TOKEN_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="tokengroup__title">{group.label}</div>
                  <div className="tokengroup__hint">{group.hint}</div>
                  {group.keys.map((item) => (
                    <div key={item.key} className="tokenrow">
                      <span className="tokenrow__label">{item.label}</span>
                      <input
                        type="text"
                        value={draft.tokens[item.key] ?? ""}
                        spellCheck={false}
                        onChange={(event) => setToken(item.key, event.currentTarget.value)}
                      />
                      {item.type === "color" ? (
                        <input
                          type="color"
                          value={colorValue(draft.tokens[item.key])}
                          aria-label={`${item.label}颜色`}
                          onChange={(event) => setToken(item.key, event.currentTarget.value)}
                        />
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {error ? <p className="formerr">{error}</p> : null}
          </div>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="删除主题"
          message={`「${pendingDelete.name}」会从账号里移除；如果它正在使用，将回到内置主题。`}
          confirmLabel="删除"
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void removeTheme()}
        />
      ) : null}
    </div>
  );
}
