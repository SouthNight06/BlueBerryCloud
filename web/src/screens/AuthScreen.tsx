import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { api, checkServer, getApiBase, isNativeApp, setApiBase } from "../api/client";
import type { AuthResponse } from "../api/types";
import { Icon } from "../components/Icon";
import { describeError } from "../lib/format";

type Mode = "login" | "register";

const NOTES = [
  { icon: "cloud", text: "歌单、主题与偏好都存在服务器，换设备登录即可继续" },
  { icon: "download", text: "合规曲库与本地文件都能导入，随时下载到本机" },
  { icon: "swatch", text: "12 个主题变量，自己配色，也可以导入别人的 JSON" },
] as const;

export function AuthScreen({ onAuthed }: { onAuthed: (auth: AuthResponse) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const native = isNativeApp();
  const [base, setBase] = useState(getApiBase());
  const [serverOpen, setServerOpen] = useState(native && !getApiBase());
  const [serverInput, setServerInput] = useState(getApiBase());
  const [serverNote, setServerNote] = useState("");
  const [serverBusy, setServerBusy] = useState(false);

  const saveServer = useCallback(async () => {
    if (serverBusy) return;
    const candidate = serverInput.trim();
    if (!candidate) {
      setApiBase("");
      setBase("");
      setServerNote("已恢复为随应用内置的服务器");
      return;
    }
    setServerBusy(true);
    setServerNote("正在连接…");
    const reachable = await checkServer(candidate);
    setServerBusy(false);
    if (!reachable) {
      setServerNote("连不上这台服务器，检查地址和网络后再试");
      return;
    }
    setApiBase(candidate);
    setBase(getApiBase());
    setServerNote("已连接，可以登录了");
    setServerOpen(false);
  }, [serverBusy, serverInput]);

  const switchMode = useCallback(() => {
    setMode((value) => (value === "login" ? "register" : "login"));
    setError("");
    setConfirmation("");
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) return;

      const name = username.trim();
      if (name.length < 3) {
        setError("用户名至少 3 位");
        return;
      }
      if (password.length < 6) {
        setError("密码至少 6 位");
        return;
      }
      if (mode === "register" && password !== confirmation) {
        setError("两次输入的密码不一致");
        return;
      }

      setError("");
      setBusy(true);
      try {
        const auth =
          mode === "login"
            ? await api.login(name, password)
            : await api.register(name, password);
        onAuthed(auth);
      } catch (failure) {
        setError(describeError(failure));
      } finally {
        setBusy(false);
      }
    },
    [busy, confirmation, mode, onAuthed, password, username],
  );

  const registering = mode === "register";

  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="auth__word">
          <span className="rail__mark" />
          小云畅听
        </div>

        <h1 className="auth__pitch">
          把喜欢的音乐，
          <br />
          收进一间<em>只属于你</em>的房间。
        </h1>

        <ul className="auth__notes">
          {NOTES.map((note) => (
            <li key={note.icon}>
              <Icon name={note.icon} size={15} />
              <span>{note.text}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="auth__panel">
        <form className="auth__form" onSubmit={submit} noValidate>
          <div>
            <h2 className="auth__title">{registering ? "创建账号" : "登录"}</h2>
            <p className="auth__hint">
              {registering
                ? "用户名 3–32 位，可用中文、字母、数字或 _ . -"
                : "用你的账号继续，数据会从云端同步回来"}
            </p>
          </div>

          <label className="field">
            <span className="field__label">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={32}
              placeholder="xiaoyun"
            />
          </label>

          <label className="field">
            <span className="field__label">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={registering ? "new-password" : "current-password"}
              placeholder="至少 6 位"
            />
          </label>

          {registering ? (
            <label className="field">
              <span className="field__label">确认密码</span>
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                placeholder="再输入一次"
              />
            </label>
          ) : null}

          {error ? (
            <p className="formerr" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "请稍候…" : registering ? "创建并登录" : "登录"}
          </button>

          <p className="auth__switch">
            {registering ? "已经有账号了？" : "还没有账号？"}
            <button type="button" onClick={switchMode}>
              {registering ? "直接登录" : "注册一个"}
            </button>
          </p>
        </form>

        {native || base ? (
          <div className="auth__server">
            <button
              type="button"
              className="auth__serverlink"
              onClick={() => setServerOpen((value) => !value)}
            >
              <Icon name="cloud" size={13} />
              {base ? `服务器 · ${base}` : "尚未设置服务器地址"}
            </button>

            {serverOpen ? (
              <div className="auth__serverbox">
                <input
                  value={serverInput}
                  onChange={(event) => setServerInput(event.target.value)}
                  placeholder="http://192.168.1.10:3001"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="url"
                />
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={saveServer}
                  disabled={serverBusy}
                >
                  {serverBusy ? "测试中…" : "测试并保存"}
                </button>
              </div>
            ) : null}

            {serverNote ? <p className="auth__servernote">{serverNote}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
