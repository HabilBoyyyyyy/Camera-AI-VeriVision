"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';



import {useAuth} from "@/lib/AuthContext";

function MenuIcon(p) { return <FontAwesomeIcon icon={faBars} className={p.className || ''} /> ; }

export default function Header({onMenuToggle}) {
  const {user} = useAuth();

  return (
    <header className="h-14 border-b border-[#2b313a] bg-[#181c22] flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded text-[#8a93a3] hover:text-[#dbe0e6] hover:bg-[#232830] transition-colors">
          <MenuIcon className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 font-mono">
          <span className="text-[10px] font-bold text-[#5a6270] uppercase tracking-widest">
            VeriVision
          </span>
          <span className="text-[10px] text-[#3a4149]">/</span>
          <span className="text-[10px] font-bold text-[#f5a623] uppercase tracking-widest">
            Inspection Platform
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#8a93a3] uppercase tracking-widest font-mono">
              {user.role}
            </span>
            <div className="status-dot-active" />
          </div>
        )}
      </div>
    </header>
  );
}
