"use client";

import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faRobot,
  faTimes,
  faCommentDots,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";

import {useState, useRef, useEffect, useCallback} from "react";
import {sendChatMessage} from "@/lib/api";

// ── Markdown-like parser for bot messages ──────────────────────────────────
function parseMessage(content) {
  const lines = content.split("\n");
  const result = [];
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  const processTable = () => {
    if (tableRows.length > 0) {
      result.push(
        <div
          className="overflow-x-auto w-full my-2"
          key={`table-${result.length}`}>
          <table className="chat-markdown w-full text-sm">
            {tableHeaders.length > 0 && (
              <thead>
                <tr>
                  {tableHeaders.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[#2b313a] hover:bg-[#1e232a]">
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  const parseInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="text-[#e4e7eb] font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
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
      const cells = line
        .split("|")
        .filter((c) => c.trim() !== "")
        .map((c) => parseInline(c.trim()));

      if (line.includes("---") || line.includes("|-")) {
        // Divider row, skip
      } else if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
    } else {
      if (inTable) processTable();

      if (line.trim().startsWith("- ")) {
        result.push(
          <li key={`li-${index}`} className="ml-4 list-disc mb-1">
            {parseInline(line.trim().substring(2))}
          </li>,
        );
      } else {
        result.push(
          <p key={`p-${index}`} className="mb-2 leading-relaxed">
            {parseInline(line)}
          </p>,
        );
      }
    }
  });

  if (inTable) processTable();
  return result;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "msg_init",
      role: "assistant",
      content:
        "Hello! I'm VeriVision's Operations Assistant. Ask me about **yield rates**, **defects**, **model status**, or type **help** to see everything I can do!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // ── Drag state ─────────────────────────────────────────────────────────
  const [btnPos, setBtnPos] = useState({bottom: 88, right: 24});
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const dragStartRef = useRef({x: 0, y: 0, bottom: 0, right: 0});

  const onPointerDown = useCallback(
    (e) => {
      if (isOpen) return; // don't drag when chat is open
      e.preventDefault();
      setDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        bottom: btnPos.bottom,
        right: btnPos.right,
      };
      dragRef.current?.setPointerCapture(e.pointerId);
    },
    [btnPos, isOpen],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setBtnPos({
        bottom: Math.max(8, dragStartRef.current.bottom - dy),
        right: Math.max(8, dragStartRef.current.right - dx),
      });
    },
    [dragging],
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!dragging) return;
      setDragging(false);
      dragRef.current?.releasePointerCapture(e.pointerId);

      // If barely moved, treat as click
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
      if (dx < 5 && dy < 5) {
        setIsOpen(true);
      }
    },
    [dragging],
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await sendChatMessage(userMsg.content);
      setMessages((prev) => [...prev, response]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content:
            "⚠️ Sorry, I couldn't reach the backend. Make sure the server is running.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    setIsTyping(false);
  };

  return (
    <>
      {/* ── Floating Draggable Button ─────────────────────────────────────── */}
      {!isOpen && (
        <div
          ref={dragRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="fixed z-50 select-none touch-none"
          style={{
            bottom: `${btnPos.bottom}px`,
            right: `${btnPos.right}px`,
          }}>
          <div
            className={`relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#f5a623] to-[#e8941a] shadow-[0_4px_20px_rgba(245,166,35,0.4)] hover:shadow-[0_4px_28px_rgba(245,166,35,0.6)] hover:scale-110 transition-all duration-300 ${
              dragging ? "cursor-grabbing scale-105" : "cursor-pointer"
            }`}>
            <FontAwesomeIcon
              icon={faCommentDots}
              className="w-6 h-6 text-[#14171c]"
            />
            {/* Drag grip indicator */}
            <div className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100">
              <FontAwesomeIcon
                icon={faGripVertical}
                className="w-3 h-3 text-[#14171c]/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Popup Window ─────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed z-50 bottom-6 right-6 w-[380px] max-w-[calc(100vw-32px)] h-[520px] max-h-[calc(100vh-48px)] bg-[#181c22] border border-[#2b313a] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-fade-in"
          style={{animationDuration: "0.2s"}}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b313a] bg-[#181c22] rounded-t-2xl shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f5a623]/15 border border-[#f5a623]/30">
                <FontAwesomeIcon
                  icon={faRobot}
                  className="w-4 h-4 text-[#f5a623]"
                />
              </div>
              <div>
                <h3 className="font-semibold text-[#dbe0e6] text-sm">
                  Operations Assistant
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="status-dot-active" />
                  <span className="text-[10px] text-[#5a6270] font-mono">
                    Online — Heuristic AI
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-[#5a6270] hover:text-[#dbe0e6] hover:bg-[#232830] transition-colors"
              title="Minimize">
              <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
            </button>
          </div>

          {/* Message Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[90%] chat-bubble ${
                    isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}>
                  <div
                    className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                      isUser
                        ? "bg-[#7a8ba8] text-[#14171c]"
                        : "bg-[#1a1e24] border border-[#2b313a]"
                    }`}>
                    {isUser ? (
                      "You"
                    ) : (
                      <FontAwesomeIcon
                        icon={faRobot}
                        className="w-3.5 h-3.5 text-[#f5a623]"
                      />
                    )}
                  </div>
                  <div
                    className={`px-3 py-2.5 rounded-xl text-sm ${
                      isUser
                        ? "bg-[#f5a623] text-[#14171c] rounded-tr-sm font-medium"
                        : "bg-[#1a1e24] text-[#8a93a3] border border-[#2b313a] rounded-tl-sm"
                    }`}>
                    {isUser ? (
                      <p>{msg.content}</p>
                    ) : (
                      <div className="text-[13px]">
                        {parseMessage(msg.content)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 max-w-[85%] chat-bubble mr-auto">
                <div className="w-7 h-7 rounded-full bg-[#1a1e24] border border-[#2b313a] flex-shrink-0 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faRobot}
                    className="w-3.5 h-3.5 text-[#f5a623]"
                  />
                </div>
                <div className="px-4 py-3 rounded-xl rounded-tl-sm bg-[#1a1e24] border border-[#2b313a]">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-[#181c22] border-t border-[#2b313a] shrink-0 rounded-b-2xl">
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 bg-[#0f1216] border border-[#2b313a] rounded-xl px-3 py-1.5 focus-within:border-[#f5a623]/60 focus-within:ring-1 focus-within:ring-[#f5a623]/25 transition-all shadow-inner">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about inspection data..."
                className="flex-1 bg-transparent border-none text-sm text-[#dbe0e6] placeholder-[#3a4149] focus:outline-none px-1 py-1"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                  input.trim() && !isTyping
                    ? "bg-[#f5a623] text-[#14171c] hover:bg-[#ffb63f]"
                    : "bg-[#232830] text-[#3a4149] cursor-not-allowed"
                }`}>
                <FontAwesomeIcon icon={faPaperPlane} className="w-3.5 h-3.5" />
              </button>
            </form>
            <div className="mt-1.5 text-center">
              <span className="text-[9px] text-[#5a6270] font-medium tracking-wide uppercase font-mono">
                VeriVision AI Assistant
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
