"use client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faCube,
  faDatabase,
  faList,
  faMicrochip,
  faShieldAlt,
  faThLarge,
  faTimes,
  faBell,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useAuth} from "@/lib/AuthContext";

function ShieldEyeIcon(p) {
  return <FontAwesomeIcon icon={faShieldAlt} className={p.className || ""} />;
}
function GridIcon(p) {
  return <FontAwesomeIcon icon={faThLarge} className={p.className || ""} />;
}
function DatabaseIcon(p) {
  return <FontAwesomeIcon icon={faDatabase} className={p.className || ""} />;
}
function CpuIcon(p) {
  return <FontAwesomeIcon icon={faMicrochip} className={p.className || ""} />;
}
function CubeIcon(p) {
  return <FontAwesomeIcon icon={faCube} className={p.className || ""} />;
}
function CameraIcon(p) {
  return <FontAwesomeIcon icon={faCamera} className={p.className || ""} />;
}
function ListIcon(p) {
  return <FontAwesomeIcon icon={faList} className={p.className || ""} />;
}
function XIcon(p) {
  return <FontAwesomeIcon icon={faTimes} className={p.className || ""} />;
}
function LogOutIcon(p) {
  return <FontAwesomeIcon icon={faSignOutAlt} className={p.className || ""} />;
}
function BellIcon(p) {
  return <FontAwesomeIcon icon={faBell} className={p.className || ""} />;
}

const adminNavItems = [
  {href: "/", label: "Dashboard", icon: (cls) => <GridIcon className={cls} />},
  {
    href: "/datasets",
    label: "Datasets",
    icon: (cls) => <DatabaseIcon className={cls} />,
  },
  {
    href: "/training",
    label: "Training",
    icon: (cls) => <CpuIcon className={cls} />,
  },
  {
    href: "/models",
    label: "Models",
    icon: (cls) => <CubeIcon className={cls} />,
  },
  {
    href: "/live",
    label: "Live Inspection",
    icon: (cls) => <CameraIcon className={cls} />,
  },
  {
    href: "/results",
    label: "Results",
    icon: (cls) => <ListIcon className={cls} />,
  },
  {
    href: "/alerts",
    label: "Alerts",
    icon: (cls) => <BellIcon className={cls} />,
  },
];

const inspectorNavItems = [
  {href: "/", label: "Dashboard", icon: (cls) => <GridIcon className={cls} />},
  {
    href: "/live",
    label: "Live Inspection",
    icon: (cls) => <CameraIcon className={cls} />,
  },
  {
    href: "/results",
    label: "Results",
    icon: (cls) => <ListIcon className={cls} />,
  },
  {
    href: "/alerts",
    label: "Alerts",
    icon: (cls) => <BellIcon className={cls} />,
  },
];

export default function Sidebar({isOpen, onClose}) {
  const pathname = usePathname();
  const {user, logout, isAdmin} = useAuth();

  const navItems = isAdmin ? adminNavItems : inspectorNavItems;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#181c22] border-r border-[#2b313a] flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#f5a623]" />

        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-[#2b313a]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-7 h-7 object-contain"
              />
            </div>
            <div>
              <p className="font-display text-base font-bold text-[#dbe0e6] tracking-wide leading-none uppercase">
                VeriVision
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-[#5a6270] font-mono font-medium tracking-widest uppercase">
                  Platform
                </span>
                <span className="text-[8px] bg-[#232830] text-[#8a93a3] px-1 rounded-sm font-mono border border-[#2b313a]">
                  v2.0
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded text-[#8a93a3] hover:text-[#dbe0e6] hover:bg-[#232830] transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <div className="section-label px-3 mb-3">Navigation</div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors duration-150 group ${
                    isActive
                      ? "text-[#e4e7eb] bg-[#232830]"
                      : "text-[#8a93a3] hover:text-[#dbe0e6] hover:bg-[#1e232a]"
                  }`}>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-[#f5a623]" />
                  )}
                  {item.icon(
                    `w-[18px] h-[18px] transition-colors ${isActive ? "text-[#f5a623]" : "text-[#5a6270] group-hover:text-[#8a93a3]"}`,
                  )}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="border-t border-[#2b313a] p-4">
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded bg-[#232830] border border-[#333b46] flex items-center justify-center text-xs font-bold text-[#dbe0e6] font-mono">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#dbe0e6] truncate">
                    {user.username}
                  </p>
                  <p className="text-[10px] text-[#5a6270] uppercase tracking-widest font-mono">
                    {user.role}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded text-[#5a6270] hover:text-[#f26e72] hover:bg-[#e5484d]/10 transition-colors"
                title="Logout">
                <LogOutIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
