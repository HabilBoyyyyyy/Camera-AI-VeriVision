import os
import re

# FontAwesome icon mappings
ICON_MAP = {
    "CameraIcon": "faCamera",
    "FileTextIcon": "faFileAlt",
    "ListIcon": "faList",
    "CubeIcon": "faCube",
    "BellIcon": "faBell",
    "ChatIcon": "faCommentDots",
    "ShieldEyeIcon": "faShieldAlt",
    "XIcon": "faTimes",
    "MenuIcon": "faBars",
    "SendIcon": "faPaperPlane",
    "BotIcon": "faRobot",
    "MessageCircleIcon": "faComment",
    "CpuIcon": "faMicrochip",
    "GridIcon": "faThLarge",
    "DatabaseIcon": "faDatabase",
    "ArrowRightIcon": "faArrowRight",
    "ShieldIcon": "faShieldAlt",
    "AlertIcon": "faExclamationTriangle",
    "TrophyIcon": "faTrophy",
    "ClipboardIcon": "faClipboard",
    "CheckCircleIcon": "faCheckCircle",
    "XCircleIcon": "faTimesCircle",
    "LayersIcon": "faLayerGroup",
    "AlertTriangleIcon": "faExclamationTriangle",
    "InfoIcon": "faInfoCircle",
    "FolderIcon": "faFolder",
    "ImageIcon": "faImage",
    "ArrowLeftIcon": "faArrowLeft",
    "TrashIcon": "faTrash",
    "UploadIcon": "faUpload",
    "LogOutIcon": "faSignOutAlt",
    "DownloadIcon": "faDownload",
    "ChevronIcon": "faChevronDown",
    "ChevronLeftIcon": "faChevronLeft",
    "ChevronRightIcon": "faChevronRight",
    "PlayIcon": "faPlay",
    "CheckIcon": "faCheck",
    "FlameIcon": "faFire",
    "HelpCircleIcon": "faQuestionCircle",
    "TrendingDownIcon": "faChartLine", # faChartLineDown doesn't exist in free, use faChartLine
    "SparkleIcon": "faWandMagicSparkles",
    "RefreshIcon": "faSync",
    "UserIcon": "faUser"
}

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Find all inline SVG functions, handling multi-line bodies
    # E.g.: function CameraIcon(p) { return (<svg ...</svg>); }
    pattern = r"function\s+([A-Za-z0-9_]+Icon)\s*\([^)]*\)\s*\{\s*return\s*\(?\s*<svg[^>]*>.*?</svg>\s*\)?\s*;\s*\}"
    matches = list(re.finditer(pattern, content, flags=re.DOTALL))
    
    if not matches:
        return False

    imports = set()
    for match in matches:
        icon_name = match.group(1)
        if icon_name in ICON_MAP:
            imports.add(ICON_MAP[icon_name])
    
    if not imports:
        return False

    # Create the import string
    import_str = "import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';\n"
    import_str += f"import {{ {', '.join(sorted(list(imports)))} }} from '@fortawesome/free-solid-svg-icons';\n\n"

    # Replace each function
    new_content = content
    for match in matches:
        icon_name = match.group(1)
        if icon_name in ICON_MAP:
            fa_name = ICON_MAP[icon_name]
            # determine param style
            params = "p"
            if "{ className }" in match.group(0):
                params = "{ className }"
            
            replacement = f"function {icon_name}(p) {{ return <FontAwesomeIcon icon={{{fa_name}}} className={{p.className || ''}} /> ; }}"
            new_content = new_content.replace(match.group(0), replacement)

    # Insert imports at the top of the file, after "use client" if it exists
    if '"use client";' in new_content:
        new_content = new_content.replace('"use client";', '"use client";\n' + import_str, 1)
    else:
        new_content = import_str + new_content

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    return True

if __name__ == "__main__":
    count = 0
    for root, dirs, files in os.walk("d:/Documents/Camera-AI/frontend"):
        if "node_modules" in root or ".next" in root:
            continue
        for file in files:
            if file.endswith(".js"):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    print(f"Refactored: {filepath}")
                    count += 1
    print(f"Total files refactored: {count}")
