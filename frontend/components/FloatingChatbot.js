"use client";

import {useState, useRef, useEffect, useCallback} from "react";
import {sendChatMessage} from "@/lib/api";

// ── Markdown-like parser ────────────────────────────────────────────────────
function parseMessage(content) {
  const lines = content.split("\n");
  const result = [];
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  const processTable = () => {
    if (tableRows.length > 0) {
      result.push(
        <div className="overflow-x-auto w-full my-2" key={`table-${result.length}`}>
          <table className="chat-markdown w-full text-sm">
            {tableHeaders.length > 0 && (
              <thead>
                <tr>{tableHeaders.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i} style={{borderBottom:"1px solid var(--clr-border)"}}>
                  {row.map((cell, j) => <td key={j}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false; tableHeaders = []; tableRows = [];
  };

  const parseInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} style={{color:"var(--clr-text)", fontWeight:600}}>{part.slice(2,-2)}</strong>;
      return part;
    });
  };

  lines.forEach((line, index) => {
    if (line.trim() === "") {
      if (inTable) processTable();
      else result.push(<div key={`br-${index}`} className="h-2" />);
      return;
    }
    if (line.trim().startsWith("|")) {
      inTable = true;
      const cells = line.split("|").filter(c => c.trim() !== "").map(c => parseInline(c.trim()));
      if (line.includes("---") || line.includes("|-")) { /* divider */ }
      else if (tableHeaders.length === 0) tableHeaders = cells;
      else tableRows.push(cells);
    } else {
      if (inTable) processTable();
      if (line.trim().startsWith("- ")) {
        result.push(<li key={`li-${index}`} className="ml-4 list-disc mb-1">{parseInline(line.trim().substring(2))}</li>);
      } else {
        result.push(<p key={`p-${index}`} className="mb-1.5 leading-relaxed">{parseInline(line)}</p>);
      }
    }
  });
  if (inTable) processTable();
  return result;
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function FloatingChatbot() {
  const [isOpen,   setIsOpen]   = useState(false);
  const [messages, setMessages] = useState([{
    id: "msg_init", role: "assistant",
    content: "Hello! I'm **VeriAssist**, your AI operations assistant. Ask me about **yield rates**, **defect trends**, **model status**, or type **help** to see what I can do!",
    timestamp: new Date().toISOString(),
  }]);
  const [input,    setInput]    = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Draggable button
  const [btnPos,   setBtnPos]   = useState({bottom: 24, right: 24});
  const [dragging, setDragging] = useState(false);
  const dragRef     = useRef(null);
  const dragStartRef = useRef({x:0, y:0, bottom:0, right:0});

  const onPointerDown = useCallback((e) => {
    if (isOpen) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = {x:e.clientX, y:e.clientY, bottom:btnPos.bottom, right:btnPos.right};
    dragRef.current?.setPointerCapture(e.pointerId);
  }, [btnPos, isOpen]);

  const onPointerMove = useCallback((e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setBtnPos({
      bottom: Math.max(8, dragStartRef.current.bottom - dy),
      right:  Math.max(8, dragStartRef.current.right  - dx),
    });
  }, [dragging]);

  const onPointerUp = useCallback((e) => {
    if (!dragging) return;
    setDragging(false);
    dragRef.current?.releasePointerCapture(e.pointerId);
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    if (dx < 5 && dy < 5) setIsOpen(true);
  }, [dragging]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping, isOpen]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;
    const userMsg = {id:`usr_${Date.now()}`, role:"user", content:input.trim(), timestamp:new Date().toISOString()};
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const response = await sendChatMessage(userMsg.content);
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [...prev, {
        id:`err_${Date.now()}`, role:"assistant",
        content:"⚠️ Couldn't reach the backend. Please ensure the server is running at port 8000.",
        timestamp: new Date().toISOString(),
      }]);
    }
    setIsTyping(false);
  };

  return (
    <>
      {/* ── Floating Trigger Button ─────────────────────────────── */}
      {!isOpen && (
        <div
          ref={dragRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="fixed z-50 select-none touch-none"
          style={{bottom:`${btnPos.bottom}px`, right:`${btnPos.right}px`}}
        >
          <div
            className={`relative flex items-center justify-center w-14 h-14 rounded-xl shadow-lg transition-all duration-200 ${dragging ? "cursor-grabbing scale-105" : "cursor-pointer hover:scale-105"}`}
            style={{
              background: "var(--clr-accent)",
              color: "#ffffff",
              boxShadow: "0 4px 20px rgba(0,140,199,0.4)",
            }}
          >
            <span className="material-symbols-outlined text-[26px]" style={{color:"#ffffff"}}>smart_toy</span>
            {/* Ping dot */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          </div>
        </div>
      )}

      {/* ── Chat Popup Window ───────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed z-50 bottom-6 right-6 flex flex-col rounded-xl overflow-hidden animate-fade-in"
          style={{
            width: "340px",
            maxWidth: "calc(100vw - 32px)",
            height: "500px",
            background: "var(--clr-surface)",
            border: "1px solid var(--clr-border)",
            boxShadow: "0 20px 60px rgba(0,0,0,.25)",
            animationDuration: "0.2s",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{background:"var(--clr-accent)"}}>
                <span className="material-symbols-outlined text-[18px]" style={{color:"#fff"}}>smart_toy</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>VeriAssist AI</h3>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg transition-colors"
              style={{color:"var(--clr-text-muted)"}}
              onMouseEnter={e => { e.currentTarget.style.background="var(--clr-surface-mid)"; e.currentTarget.style.color="var(--clr-text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background=""; e.currentTarget.style.color="var(--clr-text-muted)"; }}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-3"
            style={{background:"var(--clr-surface-low)"}}
          >
            {messages.map(msg => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 chat-bubble ${isUser ? "flex-row-reverse" : ""} max-w-[92%] ${isUser ? "ml-auto" : "mr-auto"}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: isUser ? "var(--clr-text)" : "var(--clr-accent)",
                      color: "#ffffff",
                    }}
                  >
                    {isUser
                      ? <span className="text-[9px]">You</span>
                      : <span className="material-symbols-outlined text-[12px]" style={{color:"#fff"}}>smart_toy</span>
                    }
                  </div>
                  {/* Bubble */}
                  <div
                    className="px-3 py-2 rounded-xl text-sm max-w-full"
                    style={isUser ? {
                      background: "var(--clr-text)",
                      color: "var(--clr-bg)",
                      borderBottomRightRadius: 4,
                    } : {
                      background: "var(--clr-surface)",
                      color: "var(--clr-text)",
                      border: "1px solid var(--clr-border)",
                      borderBottomLeftRadius: 4,
                    }}
                  >
                    {isUser
                      ? <p className="text-[12px] leading-relaxed">{msg.content}</p>
                      : <div className="text-[12px] leading-relaxed">{parseMessage(msg.content)}</div>
                    }
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-2 max-w-[85%] chat-bubble mr-auto items-end">
                <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center"
                  style={{background:"var(--clr-accent)"}}>
                  <span className="material-symbols-outlined text-[12px]" style={{color:"#fff"}}>smart_toy</span>
                </div>
                <div className="px-4 py-3 rounded-xl rounded-bl-sm"
                  style={{background:"var(--clr-surface)", border:"1px solid var(--clr-border)"}}>
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 shrink-0" style={{borderTop:"1px solid var(--clr-border)", background:"var(--clr-surface)"}}>
            <form onSubmit={handleSend} className="relative flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask VeriAssist…"
                style={{
                  paddingRight: "2.5rem",
                  background: "var(--clr-surface-low)",
                  borderColor: "var(--clr-border)",
                  color: "var(--clr-text)",
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-3 p-1 rounded transition-all"
                style={{
                  color: input.trim() && !isTyping ? "var(--clr-accent)" : "var(--clr-border)",
                  cursor: !input.trim() || isTyping ? "not-allowed" : "pointer",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
            <p className="text-[10px] mt-1.5 text-center" style={{color:"var(--clr-text-muted)"}}>
              Powered by VeriVision AI · Backend required
            </p>
          </div>
        </div>
      )}
    </>
  );
}
