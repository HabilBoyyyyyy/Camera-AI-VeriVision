"use client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faRobot,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

import {useState, useRef, useEffect} from "react";
import {simulateChatResponse} from "@/lib/api";

function XIcon(p) {
  return <FontAwesomeIcon icon={faTimes} className={p.className || ""} />;
}

function SendIcon(p) {
  return <FontAwesomeIcon icon={faPaperPlane} className={p.className || ""} />;
}

function BotIcon(p) {
  return <FontAwesomeIcon icon={faRobot} className={p.className || ""} />;
}

// Simple markdown-like parser for the chatbot messages
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

export default function ChatbotDrawer({isOpen, onClose}) {
  const [messages, setMessages] = useState([
    {
      id: "msg_init",
      role: "assistant",
      content:
        "Hello! I am the VeriVision Operations Assistant. The backend LLM is currently not connected, but I am ready to help you analyze inspection data once it is!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

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

    const response = await simulateChatResponse(userMsg.content);
    setMessages((prev) => [...prev, response]);
    setIsTyping(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay for mobile (closes drawer on click outside) */}
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-[#181c22] border-l border-[#2b313a] shadow-2xl flex flex-col chatbot-drawer-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b313a] bg-[#181c22]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#f5a623]/15 border border-[#f5a623]/30">
              <BotIcon className="w-4 h-4 text-[#f5a623]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#dbe0e6] text-sm">
                Inspection Assistant
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="status-dot-active" />
                <span className="text-[10px] text-[#5a6270] font-mono">
                  Online — AI powered
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#5a6270] hover:text-[#dbe0e6] hover:bg-[#232830] transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Message Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {/* Welcome msg if empty */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto bg-[#1a1e24] border border-[#2b313a] rounded-full flex items-center justify-center mb-3">
                <BotIcon className="w-6 h-6 text-[#5a6270]" />
              </div>
              <p className="text-sm text-[#8a93a3]">
                Ask me about today&apos;s defect rates, specific product sets,
                or alert history.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[90%] chat-bubble ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                    isUser
                      ? "bg-[#7a8ba8] text-[#14171c]"
                      : "bg-[#1a1e24] border border-[#2b313a]"
                  }`}>
                  {isUser ? (
                    "You"
                  ) : (
                    <BotIcon className="w-4 h-4 text-[#f5a623]" />
                  )}
                </div>
                <div
                  className={`px-4 py-2.5 rounded-lg text-sm ${
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
              <div className="w-8 h-8 rounded-full bg-[#1a1e24] border border-[#2b313a] flex-shrink-0 flex items-center justify-center">
                <BotIcon className="w-4 h-4 text-[#f5a623]" />
              </div>
              <div className="px-4 py-3 rounded-lg rounded-tl-sm bg-[#1a1e24] border border-[#2b313a]">
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
        <div className="p-3 bg-[#181c22] border-t border-[#2b313a]">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 bg-[#0f1216] border border-[#2b313a] rounded px-2 py-1.5 focus-within:border-[#f5a623]/60 focus-within:ring-1 focus-within:ring-[#f5a623]/25 transition-all shadow-inner">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about inspection data..."
              className="flex-1 bg-transparent border-none text-sm text-[#dbe0e6] placeholder-[#3a4149] focus:outline-none px-2 py-1"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className={`p-1.5 rounded flex items-center justify-center transition-colors ${
                input.trim() && !isTyping
                  ? "bg-[#f5a623] text-[#14171c] hover:bg-[#ffb63f]"
                  : "bg-[#232830] text-[#3a4149] cursor-not-allowed"
              }`}>
              <SendIcon className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[9px] text-[#5a6270] font-medium tracking-wide uppercase font-mono">
              AI Data Assistant
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
