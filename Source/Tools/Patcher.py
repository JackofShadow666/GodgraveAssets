import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext, messagebox
import webbrowser
import os
import re
import hashlib
from pathlib import Path
from datetime import datetime
import json
import threading
from dataclasses import dataclass
from typing import Optional, List, Tuple, Dict, Set
from collections import Counter
import shutil

# ============================================================================
# КЛАССЫ ДЛЯ УПРАВЛЕНИЯ ДАННЫМИ
# ============================================================================

@dataclass
class FileInfo:
    """Информация о файле"""
    path: str
    hash: Optional[str]
    lines: int
    has_bom: bool
    size: int
    encoding: str = 'utf-8'
    
    def to_dict(self) -> dict:
        return {
            'path': self.path,
            'hash': self.hash,
            'lines': self.lines,
            'has_bom': self.has_bom,
            'size': self.size,
            'encoding': self.encoding
        }

@dataclass
class PatchResult:
    """Результат применения патча"""
    success: bool
    message: str
    changes_count: int
    before_hash: Optional[str]
    after_hash: Optional[str]
    errors: List[str]
    new_content: str = ''  # <--- ДОБАВЛЕНО!

@dataclass
class FunctionInfo:
    """Информация о функции"""
    name: str
    line: int
    end_line: int
    type: str
    description: str = ''
    code: str = ''

# ============================================================================
# УМНЫЙ АНАЛИЗАТОР
# ============================================================================

class SmartAnalyzer:
    def __init__(self):
        self.functions: Dict[str, FunctionInfo] = {}
        self.colors: Dict[str, List[int]] = {}
        self.sprites: Dict[str, List[int]] = {}
        self.variables: Dict[str, List[int]] = {}
        self.classes: Dict[str, int] = {}
        
        self.categories = {
            'visual': ['draw', 'render', 'paint', 'show', 'display', 'char', 'player', 'dummy', 'sword', 'shield', 'arena', 'hud', 'sprite', 'image', 'canvas'],
            'physics': ['update', 'move', 'collision', 'hit', 'damage', 'physics', 'gravity', 'velocity', 'position', 'speed'],
            'combat': ['attack', 'defense', 'block', 'dodge', 'parry', 'strike', 'swing', 'clash', 'blade', 'shield', 'damage'],
            'ai': ['ai', 'bot', 'dummy', 'enemy', 'behavior', 'tactic', 'strategy', 'smart', 'learn'],
            'network': ['net', 'sync', 'peer', 'send', 'receive', 'connect', 'disconnect', 'socket', 'signal'],
            'audio': ['sound', 'music', 'play', 'audio', 'sfx', 'volume', 'track'],
            'ui': ['hud', 'panel', 'menu', 'overlay', 'button', 'label', 'input', 'slider'],
            'data': ['load', 'save', 'read', 'write', 'file', 'json', 'data', 'config', 'settings'],
            'math': ['calc', 'math', 'angle', 'radian', 'deg', 'lerp', 'clamp', 'random'],
            'init': ['init', 'setup', 'start', 'begin', 'create', 'build', 'construct'],
        }
    
    def _get_description(self, name: str, line: str, context: List[str]) -> str:
        name_lower = name.lower()
        full_context = ' '.join(context[:5]).lower()
        
        if any(kw in name_lower for kw in ['draw', 'render', 'paint']):
            if 'char' in name_lower or 'player' in name_lower:
                return '🎨 Рисование персонажа'
            if 'sword' in name_lower or 'weapon' in name_lower:
                return '🎨 Рисование оружия'
            if 'shield' in name_lower:
                return '🎨 Рисование щита'
            if 'arena' in name_lower or 'bg' in name_lower or 'background' in name_lower:
                return '🎨 Рисование фона/арены'
            if 'hud' in name_lower or 'ui' in name_lower:
                return '🎨 Рисование интерфейса'
            return '🎨 Визуальная функция'
        
        if 'update' in name_lower:
            if 'ai' in name_lower or 'bot' in name_lower:
                return '🔄 Обновление ИИ/бота'
            if 'hud' in name_lower or 'ui' in name_lower:
                return '🔄 Обновление интерфейса'
            return '🔄 Функция обновления'
        
        if any(kw in name_lower for kw in ['collision', 'hit', 'damage', 'attack', 'block', 'dodge']):
            return '⚔️ Боевая функция'
        
        if any(kw in name_lower for kw in ['ai', 'bot', 'dummy']):
            return '🤖 Функция ИИ'
        
        if any(kw in name_lower for kw in ['net', 'sync', 'peer', 'connect']):
            return '🌐 Сетевая функция'
        
        if any(kw in name_lower for kw in ['sound', 'music', 'audio']):
            return '🔊 Звуковая функция'
        
        if any(kw in name_lower for kw in ['hud', 'panel', 'menu', 'overlay', 'button']):
            return '📱 Функция интерфейса'
        
        if any(kw in name_lower for kw in ['load', 'save', 'read', 'write', 'file', 'json']):
            return '💾 Функция данных'
        
        return '📦 Общая функция'
    
    def _scan_functions(self, lines: List[str]):
        self.functions = {}
        patterns = [
            r'function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(',
            r'([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*function\s*\(',
            r'([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\([^)]*\)\s*=>',
            r'(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\([^)]*\)\s*=>',
        ]
        
        for i, line in enumerate(lines, 1):
            for pattern in patterns:
                match = re.search(pattern, line)
                if match:
                    name = match.group(1)
                    if name not in self.functions and len(name) > 1:
                        f_type = 'function'
                        if '=>' in line:
                            f_type = 'arrow'
                        
                        start = max(0, i-3)
                        end = min(len(lines), i+5)
                        context = lines[start:end]
                        desc = self._get_description(name, line, context)
                        
                        self.functions[name] = FunctionInfo(
                            name=name,
                            line=i,
                            end_line=self._find_function_end(lines, i),
                            type=f_type,
                            description=desc
                        )
                    break
    
    def _find_function_end(self, lines: List[str], start: int) -> int:
        brace_count = 0
        found_start = False
        for j in range(start, len(lines)):
            line = lines[j]
            if '{' in line:
                brace_count += line.count('{')
                found_start = True
            if '}' in line:
                brace_count -= line.count('}')
            if found_start and brace_count == 0:
                return j
        return len(lines) - 1
    
    def _scan_colors(self, lines: List[str]):
        self.colors = {}
        hex_pattern = r'#[0-9a-fA-F]{6}'
        for i, line in enumerate(lines, 1):
            for match in re.finditer(hex_pattern, line):
                color = match.group()
                if color not in self.colors:
                    self.colors[color] = []
                self.colors[color].append(i)
    
    def _scan_sprites(self, lines: List[str]):
        self.sprites = {}
        pattern = r'(["\'])([^"\']+\.png)\1'
        for i, line in enumerate(lines, 1):
            for match in re.finditer(pattern, line):
                sprite = match.group(2)
                sprite_name = os.path.basename(sprite)
                if sprite_name not in self.sprites:
                    self.sprites[sprite_name] = []
                self.sprites[sprite_name].append(i)
    
    def _scan_variables(self, lines: List[str]):
        self.variables = {}
        patterns = [
            r'(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[=;]',
            r'([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:new|function|{)',
        ]
        for i, line in enumerate(lines, 1):
            for pattern in patterns:
                for match in re.finditer(pattern, line):
                    name = match.group(1)
                    if len(name) > 2 and name not in ['let', 'var', 'const', 'new']:
                        if name not in self.variables:
                            self.variables[name] = []
                        self.variables[name].append(i)
    
    def _scan_classes(self, lines: List[str]):
        self.classes = {}
        pattern = r'class\s+([a-zA-Z_][a-zA-Z0-9_]*)'
        for i, line in enumerate(lines, 1):
            match = re.search(pattern, line)
            if match:
                self.classes[match.group(1)] = i
    
    def _detect_components(self, content: str) -> List[str]:
        components = []
        if 'canvas' in content:
            components.append('Canvas - игровой движок')
        if 'P.' in content and 'D.' in content:
            components.append('Игрок (P) - управление, анимация, HP')
        if 'D.' in content and 'dummy' in content.lower():
            components.append('Бот (D) - AI, бой, HP')
        if 'drawArena' in content or 'buildArena' in content:
            components.append('Арена - фон, сетка, зона')
        if 'updateHUD' in content:
            components.append('HUD - HP бары, стамина, ярость')
        if 'drawSword' in content:
            components.append('Оружие - меч, щит, спрайты')
        if 'NET_SYNC' in content or 'NET_CORE' in content:
            components.append('Сеть - мультиплеер')
        if 'playSound' in content or 'loadAudioDB' in content:
            components.append('Звук - музыка, SFX')
        return components
    
    def analyze(self, content: str, filepath: str = '') -> str:
        lines = content.split('\n')
        total_lines = len(lines)
        
        self._scan_functions(lines)
        self._scan_colors(lines)
        self._scan_sprites(lines)
        self._scan_variables(lines)
        self._scan_classes(lines)
        
        report = []
        report.append("=" * 70)
        report.append("📊 ПОЛНЫЙ АНАЛИЗ ПРОЕКТА")
        report.append("=" * 70)
        report.append("")
        report.append("📁 ИНФОРМАЦИЯ:")
        if filepath:
            report.append(f"  • Имя: {Path(filepath).name}")
            if os.path.exists(filepath):
                report.append(f"  • Размер: {os.path.getsize(filepath):,} байт")
        report.append(f"  • Строк: {total_lines:,}")
        report.append(f"  • Функций: {len(self.functions)}")
        report.append(f"  • Цветов: {len(self.colors)}")
        report.append(f"  • Спрайтов: {len(self.sprites)}")
        report.append("")
        report.append("📂 СТРУКТУРА:")
        if '<head>' in content:
            report.append("  • HTML: <head> + <body>")
        if '<style>' in content:
            report.append("  • CSS: встроенный стиль")
        if 'canvas' in content:
            report.append("  • Canvas: игровой движок")
        report.append("")
        report.append("🎯 ГЛАВНЫЕ КОМПОНЕНТЫ:")
        components = self._detect_components(content)
        for i, comp in enumerate(components, 1):
            report.append(f"  {i}. {comp}")
        report.append("")
        report.append("📋 КЛЮЧЕВЫЕ ФУНКЦИИ:")
        report.append("  /list              - все функции")
        report.append("  /list visual       - визуальные функции")
        report.append("  /list physics      - физика/бой")
        report.append("  /list combat       - боевые функции")
        report.append("  /list ai           - ИИ функции")
        report.append("  /list network      - сетевые функции")
        report.append("  /list audio        - звуковые функции")
        report.append("  /list ui           - UI функции")
        report.append("  /find <имя>        - показать код функции")
        report.append("  /find #<цвет>      - найти все места с цветом")
        report.append("  /find .png         - найти спрайты")
        report.append("  /list colors       - все цвета")
        report.append("  /list sprites      - все спрайты")
        report.append("")
        report.append("💡 КАК РАБОТАТЬ С PATCHER:")
        report.append("  1. Нажми 'Анализ' для сканирования файла")
        report.append("  2. Используй /list для списка функций")
        report.append("  3. Используй /find <функция> для кода")
        report.append("  4. Вставь код в патч и примени")
        report.append("")
        report.append("=" * 70)
        report.append("✅ АНАЛИЗ ЗАВЕРШЁН")
        report.append("=" * 70)
        return '\n'.join(report)
    
    def list_functions(self, content: str, category: str = '') -> str:
        lines = content.split('\n')
        if not self.functions:
            self._scan_functions(lines)
        
        result = []
        result.append("=" * 70)
        if category:
            result.append(f"🎯 ФУНКЦИИ - {category.upper()}:")
        else:
            result.append("🎯 ВСЕ ФУНКЦИИ:")
        result.append("=" * 70)
        
        funcs = self.functions
        if category:
            keywords = self.categories.get(category, [])
            funcs = {k: v for k, v in self.functions.items() 
                    if any(kw in k.lower() for kw in keywords)}
        
        groups = {'visual': [], 'physics': [], 'combat': [], 'ai': [], 
                  'network': [], 'audio': [], 'ui': [], 'data': [], 
                  'math': [], 'init': [], 'other': []}
        
        for name, info in funcs.items():
            categorized = False
            for cat, keywords in self.categories.items():
                if any(kw in name.lower() for kw in keywords):
                    groups[cat].append((name, info))
                    categorized = True
                    break
            if not categorized:
                groups['other'].append((name, info))
        
        group_names = {
            'visual': '🎨 ВИЗУАЛ',
            'physics': '⚡ ФИЗИКА',
            'combat': '⚔️ БОЙ',
            'ai': '🤖 ИИ',
            'network': '🌐 СЕТЬ',
            'audio': '🔊 ЗВУК',
            'ui': '📱 ИНТЕРФЕЙС',
            'data': '💾 ДАННЫЕ',
            'math': '📐 МАТЕМАТИКА',
            'init': '🚀 ИНИЦИАЛИЗАЦИЯ',
            'other': '📦 ПРОЧЕЕ'
        }
        
        for cat, items in groups.items():
            if items:
                result.append("")
                result.append(f"📌 {group_names.get(cat, cat.upper())}:")
                for name, info in sorted(items, key=lambda x: x[0]):
                    result.append(f"  {name:25} → строка {info.line:4d}  - {info.description}")
        
        result.append("")
        result.append("=" * 70)
        result.append(f"📊 Всего: {len(funcs)} функций")
        result.append("=" * 70)
        return '\n'.join(result)
    
    def find_function(self, content: str, name: str) -> str:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if f'function {name}' in line or f'{name} = function' in line or f'{name}(' in line:
                block = []
                brace_count = 0
                found_start = False
                for j in range(i, len(lines)):
                    block_line = lines[j]
                    block.append(f"{j+1:4d} | {block_line}")
                    if '{' in block_line:
                        brace_count += block_line.count('{')
                        found_start = True
                    if '}' in block_line:
                        brace_count -= block_line.count('}')
                    if found_start and brace_count == 0:
                        break
                result = []
                result.append("=" * 70)
                result.append(f"📍 ФУНКЦИЯ {name} (строка {i+1}):")
                result.append("=" * 70)
                result.extend(block)
                result.append("=" * 70)
                return '\n'.join(result)
        return f"❌ Функция '{name}' не найдена"
    
    def find_color(self, content: str, color: str) -> str:
        lines = content.split('\n')
        if not color.startswith('#'):
            color = '#' + color
        result = []
        result.append("=" * 70)
        result.append(f"🔍 ПОИСК ЦВЕТА {color}:")
        result.append("=" * 70)
        found = 0
        for i, line in enumerate(lines, 1):
            if color in line:
                result.append(f"📍 строка {i:4d} | {line.strip()[:100]}")
                found += 1
                if found >= 20:
                    result.append(f"... и ещё {len(lines) - found} вхождений")
                    break
        if not found:
            result.append(f"❌ Цвет {color} не найден")
        else:
            result.append("")
            result.append(f"📊 Найдено: {found} вхождений")
            result.append("")
            result.append("💡 Чтобы заменить цвет, используй патч:")
            result.append(f"  найти: {color}")
            result.append(f"  заменить: <новый_цвет>")
        result.append("=" * 70)
        return '\n'.join(result)
    
    def list_colors(self, content: str) -> str:
        lines = content.split('\n')
        if not self.colors:
            self._scan_colors(lines)
        result = []
        result.append("=" * 70)
        result.append("🎨 ВСЕ ЦВЕТА:")
        result.append("=" * 70)
        for color, lines_list in sorted(self.colors.items()):
            result.append(f"  {color}  → строки: {', '.join(map(str, lines_list[:5]))}{' ...' if len(lines_list) > 5 else ''}")
        result.append("")
        result.append("💡 Чтобы найти конкретный цвет:")
        result.append("  /find #FFD700    - найдёт все места с этим цветом")
        result.append("=" * 70)
        return '\n'.join(result)
    
    def list_sprites(self, content: str) -> str:
        lines = content.split('\n')
        if not self.sprites:
            self._scan_sprites(lines)
        result = []
        result.append("=" * 70)
        result.append("🖼️ ВСЕ СПРАЙТЫ:")
        result.append("=" * 70)
        categories = {}
        for sprite, lines_list in self.sprites.items():
            cat = 'other'
            if 'character' in sprite.lower() or 'knight' in sprite.lower():
                cat = 'Персонажи'
            elif 'sword' in sprite.lower() or 'weapon' in sprite.lower() or 'shield' in sprite.lower():
                cat = 'Оружие'
            elif 'bg' in sprite.lower() or 'background' in sprite.lower():
                cat = 'Фон'
            else:
                cat = 'Прочее'
            if cat not in categories:
                categories[cat] = []
            categories[cat].append((sprite, lines_list))
        for cat, items in categories.items():
            result.append("")
            result.append(f"📂 {cat}:")
            for sprite, lines_list in items:
                result.append(f"  {sprite:30} → строка {lines_list[0]}")
        result.append("")
        result.append("💡 Чтобы найти конкретный спрайт:")
        result.append("  /find knight.png    - найдёт где используется")
        result.append("=" * 70)
        return '\n'.join(result)

# ============================================================================
# ФАЙЛ МЕНЕДЖЕР
# ============================================================================

class FileManager:
    def __init__(self, backup_dir: Path):
        self.backup_dir = backup_dir
        self.backup_dir.mkdir(exist_ok=True)
        self.file_cache: Dict[str, Tuple[float, str]] = {}
        
    def get_file_hash(self, filepath: str) -> Optional[str]:
        try:
            if not os.path.exists(filepath):
                return None
            with open(filepath, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()[:16]
        except:
            return None
            
    def read_file(self, filepath: str) -> Tuple[Optional[str], Optional[str]]:
        try:
            encodings = ['utf-8-sig', 'utf-8', 'cp1251', 'latin-1']
            for enc in encodings:
                try:
                    with open(filepath, 'r', encoding=enc) as f:
                        content = f.read()
                    content_clean = content[1:] if content.startswith('\ufeff') else content
                    return content_clean, enc
                except UnicodeDecodeError:
                    continue
            with open(filepath, 'rb') as f:
                raw = f.read()
                content = raw.decode('utf-8', errors='ignore')
                return content, 'utf-8 (with errors)'
        except Exception:
            return None, None
            
    def write_file(self, filepath: str, content: str, create_backup: bool = True) -> bool:
        try:
            if create_backup and os.path.exists(filepath):
                backup_name = f"{Path(filepath).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.backup"
                backup_path = self.backup_dir / backup_name
                counter = 1
                while backup_path.exists():
                    backup_path = self.backup_dir / f"{Path(filepath).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{counter}.backup"
                    counter += 1
                shutil.copy2(filepath, backup_path)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        except Exception as e:
            raise Exception(f"Ошибка записи файла: {e}")
    
    def get_backups(self) -> List[Path]:
        return list(self.backup_dir.glob("*.backup"))
    
    def restore_backup(self, filepath: str, backup_path: Path) -> bool:
        try:
            content, _ = self.read_file(str(backup_path))
            if content is None:
                return False
            return self.write_file(filepath, content, create_backup=False)
        except Exception:
            return False

# ============================================================================
# ДВИЖОК ПАТЧЕЙ - ИСПРАВЛЕН!
# ============================================================================
class PatchEngine:
    """Движок применения патчей"""
    
    def __init__(self):
        self.error_log: List[str] = []
        
    def validate_patch(self, patch: str) -> Tuple[bool, str]:
        lines = [l.strip() for l in patch.split('\n') if l.strip()]
        
        if len(lines) < 2:
            return False, "Патч слишком короткий"
        
        has_find = any(re.match(r'(найти|find|search)\s*[:;]\s*', l, re.IGNORECASE) for l in lines)
        has_replace = any(re.match(r'(заменить|replace)\s*[:;]\s*', l, re.IGNORECASE) for l in lines)
        has_insert = any(re.match(r'(вставить|insert)\s*[:;]\s*', l, re.IGNORECASE) for l in lines)
        
        if not has_find and not has_insert:
            return False, "Патч должен содержать 'найти:' или 'вставить:'"
        
        if has_find and not has_replace and not has_insert:
            return False, "Для 'найти:' нужна 'заменить:' или 'вставить:'"
        
        return True, "OK"
        
    def parse_patch_commands(self, patch: str) -> List[Tuple[str, str, bool]]:
        commands = []
        lines = patch.split('\n')
        i = 0
        current_find = None
        current_replace = None
        use_regex = False
        
        while i < len(lines):
            line = lines[i].strip()
            
            if not line:
                i += 1
                continue
            
            # Команда "найти"
            if re.match(r'(найти|find|search)\s*[:;]\s*', line, re.IGNORECASE):
                if current_find is not None and current_replace is not None:
                    commands.append((current_find, current_replace, use_regex))
                    current_find = None
                    current_replace = None
                    use_regex = False
                
                match = re.match(r'(найти|find|search)\s*[:;]\s*(.*)', line, re.IGNORECASE)
                if match:
                    current_find = match.group(2).strip()
                    if current_find.startswith('regex:'):
                        use_regex = True
                        current_find = current_find[6:].strip()
                i += 1
            
            # Команда "заменить"
            elif re.match(r'(заменить|replace)\s*[:;]\s*', line, re.IGNORECASE):
                match = re.match(r'(заменить|replace)\s*[:;]\s*(.*)', line, re.IGNORECASE)
                if match:
                    current_replace = match.group(2).strip()
                    i += 1
                    # Собираем следующие строки до следующей команды
                    while i < len(lines):
                        next_line = lines[i].strip()
                        if re.match(r'(найти|find|search|заменить|replace|вставить|insert)\s*[:;]\s*', next_line, re.IGNORECASE):
                            break
                        if next_line:
                            current_replace += '\n' + next_line
                        else:
                            current_replace += '\n'
                        i += 1
                    
                    if current_find is not None and current_replace is not None:
                        commands.append((current_find, current_replace, use_regex))
                        current_find = None
                        current_replace = None
                        use_regex = False
                else:
                    i += 1
            
            # Команда "вставить"
            elif re.match(r'(вставить|insert)\s*[:;]\s*', line, re.IGNORECASE):
                match = re.match(r'(вставить|insert)\s*[:;]\s*(.*)', line, re.IGNORECASE)
                if match:
                    insert_text = match.group(2).strip()
                    i += 1
                    # Собираем следующие строки до следующей команды
                    while i < len(lines):
                        next_line = lines[i].strip()
                        if re.match(r'(найти|find|search|заменить|replace|вставить|insert)\s*[:;]\s*', next_line, re.IGNORECASE):
                            break
                        if next_line:
                            insert_text += '\n' + next_line
                        else:
                            insert_text += '\n'
                        i += 1
                    commands.append(('__INSERT__', insert_text, False))
                else:
                    i += 1
            
            else:
                i += 1
        
        if current_find is not None and current_replace is not None:
            commands.append((current_find, current_replace, use_regex))
        
        return commands
        
    def apply_command(self, content: str, find_text: str, replace_text: str, use_regex: bool = False) -> Tuple[str, bool, str]:
        if use_regex:
            try:
                pattern = re.compile(find_text, re.MULTILINE | re.DOTALL)
                matches = pattern.findall(content)
                if matches:
                    # lambda защищает от интерпретации '\1', '\g<name>' и т.п.
                    # внутри replace_text как ссылок на группы regex
                    new_content, n = pattern.subn(lambda m: replace_text, content)
                    if n > 1:
                        return new_content, True, f"⚠️ Заменено {n} совпадений по regex (проверьте результат!)"
                    return new_content, True, "Заменено по регулярному выражению"
                return content, False, "Регулярное выражение не найдено"
            except re.error as e:
                return content, False, f"Ошибка в регулярном выражении: {e}"

        # Точный поиск: заменяем ТОЛЬКО первое вхождение, а не все сразу.
        # content.replace(x, y) без лимита менял бы все совпадения по всему
        # файлу — если find_text встречался ещё где-то, там тоже пропадал
        # бы код. Теперь при неоднозначности мы честно предупреждаем.
        occurrences = content.count(find_text)
        if occurrences >= 1:
            new_content = content.replace(find_text, replace_text, 1)
            if occurrences > 1:
                return new_content, True, (
                    f"⚠️ Найдено {occurrences} совпадений, заменено только первое. "
                    f"Уточните 'найти:', добавив больше контекста, если нужно другое место"
                )
            return new_content, True, "Найдено и заменено"

        # Fallback: поиск строки с игнорированием пробелов.
        # Раньше здесь тоже был content.replace(line, replace_text), который
        # менял ВСЕ строки файла с таким же текстом (например, все "}"
        # или все пустые отступы) — это и есть причина "пропажи" случайных
        # строк. Теперь меняем строго строку по её индексу.
        find_stripped = find_text.strip()
        lines = content.split('\n')
        matching_indices = [i for i, line in enumerate(lines) if line.strip() == find_stripped]
        if matching_indices:
            idx = matching_indices[0]
            lines[idx] = replace_text
            new_content = '\n'.join(lines)
            if len(matching_indices) > 1:
                return new_content, True, (
                    f"⚠️ Найдено {len(matching_indices)} одинаковых строк, "
                    f"заменена первая (строка {idx + 1}). Остальные не тронуты"
                )
            return new_content, True, "Найдено (с игнорированием пробелов)"

        return content, False, "Текст не найден"
    
    def apply_insert(self, content: str, insert_text: str) -> Tuple[str, bool, str]:
        """Вставляет текст перед закрывающим тегом</body> или </html>"""
        lines = content.split('\n')
        
        # Ищем последний закрывающий тег
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].strip()
            if line == '</body>' or line == '</html>':
                lines.insert(i, insert_text)
                return '\n'.join(lines), True, f"Вставлено перед {line}"
        
        lines.append(insert_text)
        return '\n'.join(lines), True, "Вставлено в конец файла"
        
    def apply_patch(self, content: str, patch: str) -> PatchResult:
        self.error_log = []
        errors = []
        changes_count = 0
        
        valid, message = self.validate_patch(patch)
        if not valid:
            return PatchResult(False, message, 0, None, None, [message], content)
        
        commands = self.parse_patch_commands(patch)
        if not commands:
            return PatchResult(False, "Нет команд для выполнения", 0, None, None, ["Нет команд"], content)
        
        current_content = content
        
        for find_text, replace_text, use_regex in commands:
            if find_text == '__INSERT__':
                new_content, success, msg = self.apply_insert(current_content, replace_text)
                if success:
                    current_content = new_content
                    changes_count += 1
                else:
                    errors.append(msg)
                    self.error_log.append(msg)
                continue
            
            new_content, success, msg = self.apply_command(
                current_content, find_text, replace_text, use_regex
            )
            
            if success:
                current_content = new_content
                changes_count += 1
            else:
                errors.append(f"Не найдено: {find_text[:40]}...")
                self.error_log.append(msg)
        
        if errors:
            return PatchResult(
                False,
                f"Ошибок: {len(errors)}. Файл НЕ изменён",
                0,
                None,
                None,
                errors,
                content
            )
        
        if changes_count > 0:
            return PatchResult(
                True, 
                f"Применено {changes_count} патчей", 
                changes_count,
                None,
                None,
                [],
                current_content
            )
        else:
            return PatchResult(
                False,
                "Ни один патч не был применён",
                0,
                None,
                None,
                ["Нет совпадений для замены"],
                content
            )
# ============================================================================
# ГЛАВНОЕ ПРИЛОЖЕНИЕ - ИСПРАВЛЕНО!
# ============================================================================

class AnalyzerPatcher:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("🔧 Analyzer Patcher v12.0 - ИСПРАВЛЕННЫЙ")
        self.root.geometry("1300x800")
        self.root.minsize(900, 700)
        
        self.file_path = tk.StringVar()
        self.backup_dir = Path("backups")
        self.file_manager = FileManager(self.backup_dir)
        self.patch_engine = PatchEngine()
        self.smart_analyzer = SmartAnalyzer()
        
        self.current_content = ""
        self.original_hash = None
        self.error_log = []
        self._last_patch = ""
        
        self.undo_stack: List[str] = []
        self.redo_stack: List[str] = []
        self.max_history = 50
        
        self.settings_file = Path("settings.json")
        self.load_settings()
        
        self.setup_theme()
        self.create_widgets()
        self.setup_keyboard_shortcuts()
        
        if self.settings.get('auto_load_last', True):
            last_file = self.settings.get('last_file', '')
            if last_file and os.path.exists(last_file):
                self.file_path.set(last_file)
                self.load_file_from_path(last_file)
        
        # Привязка Ctrl+C и Ctrl+V для всех полей
        self._fix_clipboard()
        
        self.log("🚀 Analyzer Patcher v12.0 запущен", 'info')
        self.log("💡 Используйте 'Анализ' для сканирования файла", 'info')
        self.log("💡 Команды: /list, /find <имя>, /find #цвет", 'info')
    
    def _fix_clipboard(self):
        """Исправляет проблемы с Ctrl+C и Ctrl+V во всех текстовых полях"""
        def copy_text(event):
            widget = event.widget
            try:
                if widget.selection_get():
                    self.root.clipboard_clear()
                    self.root.clipboard_append(widget.selection_get())
            except:
                pass
            return "break"
        
        def paste_text(event):
            widget = event.widget
            try:
                text = self.root.clipboard_get()
                if text:
                    widget.insert(tk.INSERT, text)
            except:
                pass
            return "break"
        
        # Для всех текстовых полей
        for widget in [self.patch_text, self.code_text, self.analyzer_text, self.search_entry]:
            if widget:
                widget.bind('<Control-c>', copy_text)
                widget.bind('<Control-C>', copy_text)
                widget.bind('<Control-v>', paste_text)
                widget.bind('<Control-V>', paste_text)
        
        # Особо для ScrolledText
        for widget in [self.patch_text, self.code_text, self.analyzer_text]:
            if widget:
                widget.bind('<Control-c>', copy_text)
                widget.bind('<Control-C>', copy_text)
                widget.bind('<Control-v>', paste_text)
                widget.bind('<Control-V>', paste_text)
                # Также для выделения правой кнопкой
                widget.bind('<Button-3>', lambda e: None)
        
        self.log("📋 Ctrl+C/Ctrl+V исправлены для всех полей", 'info')
    
    def setup_theme(self):
        self.root.configure(bg='#1e1e1e')
        style = ttk.Style()
        style.theme_use('clam')
        colors = {
            'bg': '#1e1e1e',
            'fg': '#d4d4d4',
            'select': '#264f78',
            'hover': '#2d2d2d',
            'success': '#4ec9b0',
            'error': '#f44747',
            'warning': '#dcdcaa',
            'info': '#569cd6'
        }
        style.configure('Dark.TFrame', background=colors['bg'])
        style.configure('Dark.TLabel', background=colors['bg'], foreground=colors['fg'])
        style.configure('Dark.TButton', 
                       background=colors['hover'], 
                       foreground=colors['fg'],
                       borderwidth=0,
                       focusthickness=3,
                       focuscolor=colors['select'])
        style.map('Dark.TButton',
                 background=[('active', colors['select'])])
        style.configure('Accent.TButton', background='#1a4a6a', foreground='#ffffff')
        style.configure('Success.TButton', background='#2d6a4f', foreground='#ffffff')
        
    def create_widgets(self):
        main = ttk.Frame(self.root, style='Dark.TFrame')
        main.pack(fill='both', expand=True, padx=10, pady=10)
        
        top = ttk.Frame(main, style='Dark.TFrame')
        top.pack(fill='x', pady=(0, 10))
        
        ttk.Label(top, text="📄 Файл:", style='Dark.TLabel').pack(side='left')
        self.file_entry = ttk.Entry(top, textvariable=self.file_path, width=50)
        self.file_entry.pack(side='left', padx=5)
        self.file_entry.bind('<Return>', lambda e: self.load_file_from_path(self.file_path.get()))
        
        ttk.Button(top, text="📂 Открыть", command=self.load_file, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(top, text="💾 Сохранить", command=self.save_file, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(top, text="↩ Откатить", command=self.restore_backup, style='Dark.TButton').pack(side='left', padx=2)
        
        self.file_info_label = ttk.Label(main, text="📊 Хеш: — | Строк: — | Размер: —", style='Dark.TLabel')
        self.file_info_label.pack(anchor='w', pady=(0, 5))
        
        self.status_label = ttk.Label(main, text="✅ Готов к работе", style='Dark.TLabel')
        self.status_label.pack(anchor='w', pady=(0, 5))
        
        self.progress_frame = ttk.Frame(main, style='Dark.TFrame')
        self.progress_frame.pack(fill='x', pady=(0, 5))
        self.progress_frame.pack_forget()
        
        self.progress_bar = ttk.Progressbar(self.progress_frame, length=300, mode='indeterminate')
        self.progress_bar.pack(side='left', padx=5)
        self.progress_label = ttk.Label(self.progress_frame, text="Обработка...", style='Dark.TLabel')
        self.progress_label.pack(side='left', padx=5)
        
        self.notebook = ttk.Notebook(main)
        self.notebook.pack(fill='both', expand=True)
        
        self.create_editor_tab()
        self.create_analyzer_tab()
        self.create_history_tab()
        
        bottom = ttk.Frame(main, style='Dark.TFrame')
        bottom.pack(fill='x', pady=(10, 0))
        
        ttk.Button(bottom, text="🚀 Применить и запустить", 
                  command=self.apply_and_run, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(bottom, text="▶ Запустить", 
                  command=self.run_file, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(bottom, text="↩ Undo (Ctrl+Z)", 
                  command=self.undo, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(bottom, text="↪ Redo (Ctrl+Y)", 
                  command=self.redo, style='Dark.TButton').pack(side='left', padx=2)
        
        self.error_button = tk.Button(
            bottom,
            text="✅ Ошибок: 0",
            command=self.copy_errors,
            bg='#2d2d2d',
            fg='#4ec9b0',
            font=('Consolas', 10),
            relief='flat',
            padx=10,
            pady=5,
            cursor='hand2'
        )
        self.error_button.pack(side='right', padx=2)
        
        self.log_text = scrolledtext.ScrolledText(
            main,
            height=4,
            bg='#1e1e1e',
            fg='#569cd6',
            font=('Consolas', 9),
            wrap='word'
        )
        self.log_text.pack(fill='x', pady=(5, 0))
        
        self.log_text.tag_configure('time', foreground='#6a9955')
        self.log_text.tag_configure('info', foreground='#569cd6')
        self.log_text.tag_configure('success', foreground='#4ec9b0')
        self.log_text.tag_configure('warning', foreground='#dcdcaa')
        self.log_text.tag_configure('error', foreground='#f44747')
        
    def create_editor_tab(self):
        editor_frame = ttk.Frame(self.notebook, style='Dark.TFrame')
        self.notebook.add(editor_frame, text="📝 Редактор")
        
        editor_paned = ttk.PanedWindow(editor_frame, orient='horizontal')
        editor_paned.pack(fill='both', expand=True)
        
        left = ttk.Frame(editor_paned, style='Dark.TFrame')
        editor_paned.add(left, weight=1)
        
        ttk.Label(left, text="📋 ПАТЧ:", style='Dark.TLabel').pack(anchor='w')
        
        self.patch_text = scrolledtext.ScrolledText(
            left,
            bg='#1e1e1e',
            fg='#d4d4d4',
            insertbackground='#d4d4d4',
            font=('Consolas', 10),
            height=12,
            wrap='word'
        )
        self.patch_text.pack(fill='both', expand=True, pady=5)
        
        self.patch_text.insert('1.0', 
            "найти: <строка для поиска>\n"
            "заменить: <строка для замены>\n\n"
            "# Команды для анализатора:\n"
            "# /list              - все функции\n"
            "# /list visual       - визуальные функции\n"
            "# /find drawChar     - показать код функции\n"
            "# /find #FFD700      - найти цвет\n"
            "# /find .png         - найти спрайты"
        )
        self.patch_text.tag_configure('comment', foreground='#6a9955')
        self.patch_text.tag_add('comment', '3.0', 'end')
        self.patch_text.bind('<KeyRelease>', self.on_patch_change)
        
        btn_frame = ttk.Frame(left, style='Dark.TFrame')
        btn_frame.pack(fill='x', pady=(5, 0))
        
        ttk.Button(btn_frame, text="🔧 ПРИМЕНИТЬ (Ctrl+P)", 
                  command=self.apply_patch, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="📋 Вставить", 
                  command=self.paste_from_clipboard, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="🧹 Очистить", 
                  command=self.clear_patch, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="📂 Загрузить патч", 
                  command=self.load_patch_file, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="🔄 Сбросить ошибки", 
                  command=self.clear_errors, style='Dark.TButton').pack(side='left', padx=2)
        
        right = ttk.Frame(editor_paned, style='Dark.TFrame')
        editor_paned.add(right, weight=2)
        
        ttk.Label(right, text="📄 КОД:", style='Dark.TLabel').pack(anchor='w')
        
        self.code_text = scrolledtext.ScrolledText(
            right,
            bg='#1e1e1e',
            fg='#d4d4d4',
            insertbackground='#d4d4d4',
            font=('Consolas', 10),
            wrap='none'
        )
        self.code_text.pack(fill='both', expand=True, pady=5)
        self.code_text.bind('<Control-s>', lambda e: self.save_file())
        self.code_text.bind('<Control-z>', lambda e: self.undo())
        self.code_text.bind('<Control-y>', lambda e: self.redo())
        
        self.line_info = ttk.Label(right, text="Строка: 1 | Столбец: 1", style='Dark.TLabel')
        self.line_info.pack(anchor='w', pady=(2, 0))
        self.code_text.bind('<KeyRelease>', self.update_line_info)
        
    def create_analyzer_tab(self):
        analyzer_frame = ttk.Frame(self.notebook, style='Dark.TFrame')
        self.notebook.add(analyzer_frame, text="🔍 Анализатор")
        
        btn_panel = ttk.Frame(analyzer_frame, style='Dark.TFrame')
        btn_panel.pack(fill='x', padx=10, pady=(10, 5))
        
        btn_row1 = ttk.Frame(btn_panel, style='Dark.TFrame')
        btn_row1.pack(fill='x', pady=2)
        
        ttk.Button(btn_row1, text="📊 ПОЛНЫЙ АНАЛИЗ", 
                  command=self.full_analysis, style='Accent.TButton').pack(side='left', padx=2)
        ttk.Button(btn_row1, text="🎯 ВСЕ ФУНКЦИИ", 
                  command=self.list_all_functions, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_row1, text="🎨 ВСЕ ЦВЕТА", 
                  command=self.list_all_colors, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_row1, text="🖼️ ВСЕ СПРАЙТЫ", 
                  command=self.list_all_sprites, style='Dark.TButton').pack(side='left', padx=2)
        
        btn_row2 = ttk.Frame(btn_panel, style='Dark.TFrame')
        btn_row2.pack(fill='x', pady=2)
        
        categories = [
            ('🎨 Визуал', 'visual'),
            ('⚡ Физика', 'physics'),
            ('⚔️ Бой', 'combat'),
            ('🤖 ИИ', 'ai'),
            ('🌐 Сеть', 'network'),
            ('🔊 Звук', 'audio'),
            ('📱 UI', 'ui')
        ]
        
        for label, cat in categories:
            ttk.Button(btn_row2, text=label, 
                      command=lambda c=cat: self.list_functions_by_category(c),
                      style='Dark.TButton').pack(side='left', padx=2)
        
        btn_row3 = ttk.Frame(btn_panel, style='Dark.TFrame')
        btn_row3.pack(fill='x', pady=2)
        
        ttk.Label(btn_row3, text="🔍 Поиск:", style='Dark.TLabel').pack(side='left', padx=5)
        
        self.search_var = tk.StringVar()
        self.search_entry = ttk.Entry(btn_row3, textvariable=self.search_var, width=30)
        self.search_entry.pack(side='left', padx=5)
        self.search_entry.bind('<Return>', lambda e: self.execute_command())
        
        ttk.Button(btn_row3, text="Выполнить", 
                  command=self.execute_command, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_row3, text="📋 Копировать", 
                  command=self.copy_analysis, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_row3, text="📋 КОПИРОВАТЬ ВСЁ", 
                  command=self.copy_all_analysis, style='Accent.TButton').pack(side='left', padx=2)
        ttk.Button(btn_row3, text="💾 Сохранить", 
                  command=self.export_analysis, style='Dark.TButton').pack(side='left', padx=2)
        
        self.analyzer_text = scrolledtext.ScrolledText(
            analyzer_frame,
            bg='#1e1e1e',
            fg='#d4d4d4',
            insertbackground='#d4d4d4',
            font=('Consolas', 10),
            wrap='word'
        )
        self.analyzer_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        self.analyzer_text.tag_configure('header', foreground='#4ec9b0', font=('Consolas', 12, 'bold'))
        self.analyzer_text.tag_configure('info', foreground='#569cd6')
        self.analyzer_text.tag_configure('warning', foreground='#dcdcaa')
        self.analyzer_text.tag_configure('error', foreground='#f44747')
        self.analyzer_text.tag_configure('success', foreground='#4ec9b0')
        self.analyzer_text.tag_configure('highlight', background='#264f78')
        
        self.analyzer_text.insert('1.0',
            "🔍 ДОБРО ПОЖАЛОВАТЬ В УМНЫЙ АНАЛИЗАТОР!\n\n"
            "📋 Доступные команды:\n"
            "  /list              - все функции\n"
            "  /list visual       - визуальные функции\n"
            "  /list physics      - физика/бой\n"
            "  /list combat       - боевые функции\n"
            "  /list ai           - ИИ функции\n"
            "  /list network      - сетевые функции\n"
            "  /list audio        - звуковые функции\n"
            "  /list ui           - UI функции\n"
            "  /find <имя>        - показать код функции\n"
            "  /find #<цвет>      - найти все места с цветом\n"
            "  /find .png         - найти спрайты\n"
            "  /list colors       - все цвета\n"
            "  /list sprites      - все спрайты\n\n"
            "💡 Или используй кнопки выше для быстрого доступа!\n"
            "💡 Нажми 'ПОЛНЫЙ АНАЛИЗ' для знакомства с проектом"
        )
        
    def create_history_tab(self):
        history_frame = ttk.Frame(self.notebook, style='Dark.TFrame')
        self.notebook.add(history_frame, text="📜 История")
        
        self.history_listbox = tk.Listbox(
            history_frame,
            bg='#1e1e1e',
            fg='#d4d4d4',
            selectbackground='#264f78',
            font=('Consolas', 9),
            height=20
        )
        self.history_listbox.pack(fill='both', expand=True, padx=10, pady=10)
        
        scrollbar = ttk.Scrollbar(self.history_listbox, orient='vertical', 
                                 command=self.history_listbox.yview)
        self.history_listbox.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side='right', fill='y')
        
        history_btn_frame = ttk.Frame(history_frame, style='Dark.TFrame')
        history_btn_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        ttk.Button(history_btn_frame, text="🧹 Очистить историю", 
                  command=self.clear_history, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(history_btn_frame, text="📋 Копировать историю", 
                  command=self.copy_history, style='Dark.TButton').pack(side='left', padx=2)
        
    def setup_keyboard_shortcuts(self):
        self.root.bind('<Control-o>', lambda e: self.load_file())
        self.root.bind('<Control-p>', lambda e: self.apply_patch())
        self.root.bind('<Control-a>', lambda e: self.full_analysis())
        self.root.bind('<Control-s>', lambda e: self.save_file())
        self.root.bind('<Control-z>', lambda e: self.undo())
        self.root.bind('<Control-y>', lambda e: self.redo())
        self.root.bind('<Control-f>', lambda e: self.search_entry.focus())
        self.root.bind('<F5>', lambda e: self.full_analysis())
        self.root.bind('<F9>', lambda e: self.run_file())
        
    # ========================================================================
    # ОСНОВНЫЕ ФУНКЦИИ - ИСПРАВЛЕНЫ!
    # ========================================================================
    
    def load_file(self):
        path = filedialog.askopenfilename(
            title="Выберите файл",
            filetypes=[("HTML files", "*.html *.htm"), ("All files", "*.*")]
        )
        if not path:
            return
        self.load_file_from_path(path)
        
    def load_file_from_path(self, path: str):
        if not path or not os.path.exists(path):
            self.log(f"❌ Файл не найден: {path}", 'error')
            return
            
        self.show_progress("Загрузка файла...")
        
        try:
            content, encoding = self.file_manager.read_file(path)
            if content is None:
                self.log(f"❌ Не удалось прочитать файл: {path}", 'error')
                self.hide_progress()
                return
                
            self.file_path.set(path)
            self.current_content = content
            self.original_hash = self.file_manager.get_file_hash(path)
            
            self.code_text.delete('1.0', 'end')
            self.code_text.insert('1.0', content)
            
            self.save_state()
            self.update_file_info()
            self.add_history_entry(f"📂 Открыт файл: {Path(path).name}")
            self.log(f"✅ Загружено: {Path(path).name} ({len(content):,} символов)", 'success')
            
            self.settings['last_file'] = path
            self.save_settings()
            
        except Exception as e:
            self.log(f"❌ Ошибка загрузки: {e}", 'error')
        finally:
            self.hide_progress()
            
    def save_file(self):
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
            
        path = self.file_path.get()
        content = self.code_text.get('1.0', 'end-1c')
        
        if not content:
            self.log("⚠️ Файл пуст!", 'warning')
            return
            
        try:
            if self.file_manager.write_file(path, content):
                self.current_content = content
                self.original_hash = self.file_manager.get_file_hash(path)
                self.update_file_info()
                
                self.log(f"💾 Файл сохранён", 'success')
                self.add_history_entry(f"💾 Сохранён файл: {Path(path).name}")
                self.save_state()
            else:
                self.log("❌ Ошибка сохранения!", 'error')
                
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
            




    def apply_patch(self):
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
        
        patch = self.patch_text.get('1.0', 'end-1c').strip()
        if not patch:
            self.log("⚠️ Вставьте патч!", 'warning')
            return
        
        self.error_log = []
        self.update_error_button()
        
        # ВАЖНО: раньше здесь фильтровались ещё и пустые строки
        # (`and line.strip()`). Это ломало многострочные блоки
        # "заменить:"/"вставить:" — parse_patch_commands специально
        # сохраняет пустые строки-разделители внутри такого блока,
        # но они вырезались ещё до парсинга, и итоговый код "склеивался"
        # без пустых строк, а иногда терялись целые логические куски.
        # Теперь убираем только строки-комментарии патча (#...),
        # пустые строки внутри блоков остаются нетронутыми.
        clean_patch = '\n'.join(
            line for line in patch.split('\n')
            if not line.strip().startswith('#')
        )
        
        if not clean_patch.strip():
            self.log("⚠️ Патч содержит только комментарии!", 'warning')
            return
        
        current_content = self.code_text.get('1.0', 'end-1c')
        before_hash = self.file_manager.get_file_hash(self.file_path.get())
        
        self.log("🔍 Применение патча...", 'info')
        self.show_progress("Применение патча...")
        
        try:
            result = self.patch_engine.apply_patch(current_content, clean_patch)
            result.before_hash = before_hash
            
            if result.errors:
                self.log(f"❌ Найдено {len(result.errors)} ошибок! Файл НЕ изменён", 'error')
                self.error_log = result.errors
                self.update_error_button()
                
                error_text = "\n".join(f"• {e}" for e in result.errors[:5])
                messagebox.showerror("❌ ОШИБКА", 
                    f"Патч содержит ошибки! Файл НЕ изменён.\n\n"
                    f"Ошибки:\n{error_text}\n"
                    f"{f'\n... и ещё {len(result.errors)-5}' if len(result.errors) > 5 else ''}"
                )
                self.hide_progress()
                return
            
            if result.success and result.changes_count > 0:
                new_content = result.new_content
                
                self.file_manager.write_file(self.file_path.get(), new_content)
                result.after_hash = self.file_manager.get_file_hash(self.file_path.get())
                
                self.code_text.delete('1.0', 'end')
                self.code_text.insert('1.0', new_content)
                
                self.current_content = new_content
                self.original_hash = result.after_hash
                self.update_file_info()
                self.save_state()
                
                self.log(f"✅ {result.message}", 'success')
                self.log(f"📊 Хеш: {result.before_hash} -> {result.after_hash}", 'info')
                
                self.add_history_entry(f"🔧 Применён патч: {result.changes_count} изменений")
                
            else:
                self.log("⚠️ Ничего не изменено", 'warning')
                messagebox.showinfo("ℹ️ Информация", 
                    "Патч не нашёл ни одной строки.\n\n"
                    "💡 Используйте анализатор для поиска правильных строк!"
                )
                
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
            messagebox.showerror("❌ КРИТИЧЕСКАЯ ОШИБКА", 
                f"Произошла ошибка:\n\n{e}\n\nФайл НЕ изменён."
            )
        finally:
            self.hide_progress()












    
    # ========================================================================
    # ФУНКЦИИ АНАЛИЗАТОРА
    # ========================================================================
    
    def full_analysis(self):
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
            
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Файл пуст!", 'warning')
            return
            
        self.show_progress("Полный анализ...")
        
        try:
            result = self.smart_analyzer.analyze(content, self.file_path.get())
            
            self.analyzer_text.delete('1.0', 'end')
            self.analyzer_text.insert('1.0', result)
            
            for line_num, line in enumerate(result.split('\n'), 1):
                if line.startswith('=') or line.startswith('📊') or line.startswith('🎯'):
                    start = f"{line_num}.0"
                    end = f"{line_num}.{len(line)}"
                    self.analyzer_text.tag_add('header', start, end)
                elif '💡' in line or '📋' in line:
                    start = f"{line_num}.0"
                    end = f"{line_num}.{len(line)}"
                    self.analyzer_text.tag_add('info', start, end)
                elif '❌' in line:
                    start = f"{line_num}.0"
                    end = f"{line_num}.{len(line)}"
                    self.analyzer_text.tag_add('error', start, end)
                elif '✅' in line:
                    start = f"{line_num}.0"
                    end = f"{line_num}.{len(line)}"
                    self.analyzer_text.tag_add('success', start, end)
            
            self.notebook.select(1)
            self.log("✅ Полный анализ завершён!", 'success')
            self.add_history_entry("📊 Выполнен полный анализ")
            
        except Exception as e:
            self.log(f"❌ Ошибка анализа: {e}", 'error')
        finally:
            self.hide_progress()
    
    def list_all_functions(self):
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
            
        result = self.smart_analyzer.list_functions(content)
        self.analyzer_text.delete('1.0', 'end')
        self.analyzer_text.insert('1.0', result)
        self.notebook.select(1)
        self.log("📋 Список функций обновлён", 'info')
    
    def list_functions_by_category(self, category: str):
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
            
        result = self.smart_analyzer.list_functions(content, category)
        self.analyzer_text.delete('1.0', 'end')
        self.analyzer_text.insert('1.0', result)
        self.notebook.select(1)
        self.log(f"📋 Функции [{category}] обновлены", 'info')
    
    def list_all_colors(self):
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
            
        result = self.smart_analyzer.list_colors(content)
        self.analyzer_text.delete('1.0', 'end')
        self.analyzer_text.insert('1.0', result)
        self.notebook.select(1)
        self.log("🎨 Список цветов обновлён", 'info')
    
    def list_all_sprites(self):
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
            
        result = self.smart_analyzer.list_sprites(content)
        self.analyzer_text.delete('1.0', 'end')
        self.analyzer_text.insert('1.0', result)
        self.notebook.select(1)
        self.log("🖼️ Список спрайтов обновлён", 'info')
    
    def execute_command(self):
        command = self.search_var.get().strip()
        if not command:
            self.log("⚠️ Введите команду!", 'warning')
            return
        
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
        
        self.show_progress(f"Поиск: {command}")
        
        try:
            result = self._process_command(command, content)
            
            self.analyzer_text.delete('1.0', 'end')
            self.analyzer_text.insert('1.0', result)
            self.notebook.select(1)
            
            self.log(f"✅ Команда выполнена: {command}", 'success')
            
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
        finally:
            self.hide_progress()
    
    def _process_command(self, command: str, content: str) -> str:
        if command == '/list':
            return self.smart_analyzer.list_functions(content)
        
        if command.startswith('/list '):
            cat = command[6:].strip()
            return self.smart_analyzer.list_functions(content, cat)
        
        if command == '/list colors':
            return self.smart_analyzer.list_colors(content)
        
        if command == '/list sprites':
            return self.smart_analyzer.list_sprites(content)
        
        if command.startswith('/find '):
            what = command[6:].strip()
            if what.startswith('#'):
                return self.smart_analyzer.find_color(content, what)
            elif what.endswith('.png'):
                return self._find_sprite(content, what)
            else:
                return self.smart_analyzer.find_function(content, what)
        
        return f"❌ Неизвестная команда: {command}\n\nДоступные команды:\n  /list\n  /list <категория>\n  /find <имя>\n  /find #<цвет>\n  /list colors\n  /list sprites"
    
    def _find_sprite(self, content: str, name: str) -> str:
        lines = content.split('\n')
        result = []
        result.append("=" * 70)
        result.append(f"🔍 ПОИСК СПРАЙТА: {name}")
        result.append("=" * 70)
        
        found = 0
        for i, line in enumerate(lines, 1):
            if name in line:
                result.append(f"📍 строка {i:4d} | {line.strip()[:100]}")
                found += 1
                if found >= 20:
                    result.append(f"... и ещё {len(lines) - found} вхождений")
                    break
        
        if not found:
            result.append(f"❌ Спрайт {name} не найден")
        else:
            result.append("")
            result.append(f"📊 Найдено: {found} вхождений")
            result.append("")
            result.append("💡 Чтобы заменить спрайт, используй патч:")
            result.append(f"  найти: {name}")
            result.append(f"  заменить: <новый_файл.png>")
        
        result.append("=" * 70)
        return '\n'.join(result)
    
    def copy_all_analysis(self):
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
            
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Файл пуст!", 'warning')
            return
        
        self.show_progress("Сбор всей информации...")
        
        try:
            lines = content.split('\n')
            self.smart_analyzer._scan_functions(lines)
            self.smart_analyzer._scan_colors(lines)
            self.smart_analyzer._scan_sprites(lines)
            self.smart_analyzer._scan_variables(lines)
            self.smart_analyzer._scan_classes(lines)
            
            all_data = []
            all_data.append("=" * 80)
            all_data.append("🔍 ПОЛНЫЙ АНАЛИЗ ПРОЕКТА - ВСЕ ДАННЫЕ")
            all_data.append("=" * 80)
            all_data.append(f"📄 Файл: {Path(self.file_path.get()).name}")
            all_data.append(f"📅 Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            all_data.append("")
            
            all_data.append("=" * 80)
            all_data.append("📊 ОСНОВНАЯ ИНФОРМАЦИЯ")
            all_data.append("=" * 80)
            all_data.append(f"  • Всего строк: {len(lines):,}")
            all_data.append(f"  • Всего функций: {len(self.smart_analyzer.functions)}")
            all_data.append(f"  • Всего цветов: {len(self.smart_analyzer.colors)}")
            all_data.append(f"  • Всего спрайтов: {len(self.smart_analyzer.sprites)}")
            all_data.append(f"  • Всего переменных: {len(self.smart_analyzer.variables)}")
            all_data.append(f"  • Всего классов: {len(self.smart_analyzer.classes)}")
            all_data.append("")
            
            all_data.append("=" * 80)
            all_data.append("📂 СТРУКТУРА ПРОЕКТА")
            all_data.append("=" * 80)
            components = self.smart_analyzer._detect_components(content)
            for i, comp in enumerate(components, 1):
                all_data.append(f"  {i}. {comp}")
            all_data.append("")
            
            all_data.append("=" * 80)
            all_data.append(f"🎯 ВСЕ ФУНКЦИИ ({len(self.smart_analyzer.functions)})")
            all_data.append("=" * 80)
            
            groups = {
                'visual': [], 'physics': [], 'combat': [], 'ai': [], 
                'network': [], 'audio': [], 'ui': [], 'data': [], 
                'math': [], 'init': [], 'other': []
            }
            
            for name, info in self.smart_analyzer.functions.items():
                categorized = False
                for cat, keywords in self.smart_analyzer.categories.items():
                    if any(kw in name.lower() for kw in keywords):
                        groups[cat].append((name, info))
                        categorized = True
                        break
                if not categorized:
                    groups['other'].append((name, info))
            
            group_names = {
                'visual': '🎨 ВИЗУАЛ',
                'physics': '⚡ ФИЗИКА',
                'combat': '⚔️ БОЙ',
                'ai': '🤖 ИИ',
                'network': '🌐 СЕТЬ',
                'audio': '🔊 ЗВУК',
                'ui': '📱 ИНТЕРФЕЙС',
                'data': '💾 ДАННЫЕ',
                'math': '📐 МАТЕМАТИКА',
                'init': '🚀 ИНИЦИАЛИЗАЦИЯ',
                'other': '📦 ПРОЧЕЕ'
            }
            
            for cat, items in groups.items():
                if items:
                    all_data.append("")
                    all_data.append(f"📌 {group_names.get(cat, cat.upper())}:")
                    for name, info in sorted(items, key=lambda x: x[0]):
                        all_data.append(f"  {name:30} → строка {info.line:4d}  - {info.description}")
            
            all_data.append("")
            
            all_data.append("=" * 80)
            all_data.append(f"🎨 ВСЕ ЦВЕТА ({len(self.smart_analyzer.colors)})")
            all_data.append("=" * 80)
            for color, lines_list in sorted(self.smart_analyzer.colors.items()):
                lines_str = ', '.join(map(str, lines_list[:5]))
                if len(lines_list) > 5:
                    lines_str += f" ... (+{len(lines_list)-5})"
                all_data.append(f"  {color}  → строки: {lines_str}")
            all_data.append("")
            
            all_data.append("=" * 80)
            all_data.append(f"🖼️ ВСЕ СПРАЙТЫ ({len(self.smart_analyzer.sprites)})")
            all_data.append("=" * 80)
            sprite_cats = {}
            for sprite, lines_list in self.smart_analyzer.sprites.items():
                cat = 'other'
                if 'character' in sprite.lower() or 'knight' in sprite.lower():
                    cat = '👤 Персонажи'
                elif 'sword' in sprite.lower() or 'weapon' in sprite.lower() or 'shield' in sprite.lower():
                    cat = '⚔️ Оружие'
                elif 'bg' in sprite.lower() or 'background' in sprite.lower():
                    cat = '🌄 Фон'
                else:
                    cat = '📦 Прочее'
                if cat not in sprite_cats:
                    sprite_cats[cat] = []
                sprite_cats[cat].append((sprite, lines_list))
            for cat, items in sprite_cats.items():
                all_data.append("")
                all_data.append(f"📂 {cat}:")
                for sprite, lines_list in items:
                    all_data.append(f"  {sprite:30} → строка {lines_list[0]}")
            all_data.append("")
            
            all_data.append("=" * 80)
            all_data.append(f"📦 ВСЕ ПЕРЕМЕННЫЕ ({len(self.smart_analyzer.variables)})")
            all_data.append("=" * 80)
            for var, lines_list in sorted(self.smart_analyzer.variables.items()):
                lines_str = ', '.join(map(str, lines_list[:3]))
                if len(lines_list) > 3:
                    lines_str += f" ... (+{len(lines_list)-3})"
                all_data.append(f"  {var:25} → строки: {lines_str}")
            all_data.append("")
            
            if self.smart_analyzer.classes:
                all_data.append("=" * 80)
                all_data.append(f"🏛️ ВСЕ КЛАССЫ ({len(self.smart_analyzer.classes)})")
                all_data.append("=" * 80)
                for class_name, line in self.smart_analyzer.classes.items():
                    all_data.append(f"  {class_name:25} → строка {line}")
                all_data.append("")
            
            all_data.append("=" * 80)
            all_data.append("💡 КОМАНДЫ ДЛЯ ПОИСКА")
            all_data.append("=" * 80)
            all_data.append("  /list              - все функции")
            all_data.append("  /list visual       - визуальные функции")
            all_data.append("  /list physics      - физика/бой")
            all_data.append("  /list combat       - боевые функции")
            all_data.append("  /list ai           - ИИ функции")
            all_data.append("  /list network      - сетевые функции")
            all_data.append("  /list audio        - звуковые функции")
            all_data.append("  /list ui           - UI функции")
            all_data.append("  /find <имя>        - показать код функции")
            all_data.append("  /find #<цвет>      - найти все места с цветом")
            all_data.append("  /find .png         - найти спрайты")
            all_data.append("  /list colors       - все цвета")
            all_data.append("  /list sprites      - все спрайты")
            all_data.append("")
            all_data.append("=" * 80)
            all_data.append("✅ ВСЕ ДАННЫЕ СОБРАНЫ")
            all_data.append("=" * 80)
            
            result = '\n'.join(all_data)
            
            self.root.clipboard_clear()
            self.root.clipboard_append(result)
            
            self.analyzer_text.delete('1.0', 'end')
            self.analyzer_text.insert('1.0', result)
            self.notebook.select(1)
            
            self.log("📋 ВСЯ информация скопирована в буфер!", 'success')
            self.add_history_entry("📋 Скопирован полный анализ проекта")
            
            messagebox.showinfo("✅ ГОТОВО!", 
                "Вся информация о проекте скопирована в буфер!\n\n"
                f"📊 Функций: {len(self.smart_analyzer.functions)}\n"
                f"🎨 Цветов: {len(self.smart_analyzer.colors)}\n"
                f"🖼️ Спрайтов: {len(self.smart_analyzer.sprites)}\n"
                f"📦 Переменных: {len(self.smart_analyzer.variables)}\n"
                f"🏛️ Классов: {len(self.smart_analyzer.classes)}\n\n"
                "Теперь вставьте это в чат (Ctrl+V)")
            
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
        finally:
            self.hide_progress()
    
    # ========================================================================
    # ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
    # ========================================================================
    
    def on_patch_change(self, event=None):
        current = self.patch_text.get('1.0', 'end-1c')
        if hasattr(self, '_last_patch') and self._last_patch == current:
            return
        self._last_patch = current
        if self.error_log:
            self.error_log = []
            self.update_error_button()
            self.log("🔄 Ошибки сброшены (изменён патч)", 'info')
    
    def clear_errors(self):
        self.error_log = []
        self.update_error_button()
        self.log("🔄 Ошибки сброшены вручную", 'info')
    
    def clear_patch(self):
        self.patch_text.delete('1.0', 'end')
        self.clear_errors()
        self.log("🧹 Поле патча очищено", 'info')
    
    def paste_from_clipboard(self, clean: bool = False):
        try:
            text = self.root.clipboard_get()
            if not text:
                return
            self.error_log = []
            self.update_error_button()
            if clean:
                text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
            self.patch_text.delete('1.0', 'end')
            self.patch_text.insert('1.0', text)
            self._last_patch = text
            self.log("📋 Вставлено из буфера" + (" (очищено)" if clean else ""), 'info')
            self.log("🔄 Ошибки сброшены", 'info')
        except:
            self.log("⚠️ Буфер обмена пуст", 'warning')
    
    def load_patch_file(self):
        path = filedialog.askopenfilename(
            title="Выберите файл патча",
            filetypes=[("Patch files", "*.patch *.txt"), ("All files", "*.*")]
        )
        if not path:
            return
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            self.error_log = []
            self.update_error_button()
            self.patch_text.delete('1.0', 'end')
            self.patch_text.insert('1.0', content)
            self._last_patch = content
            self.log(f"📂 Загружен патч: {Path(path).name}", 'success')
            self.log("🔄 Ошибки сброшены", 'info')
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
    
    def copy_analysis(self):
        content = self.analyzer_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Нет данных для копирования!", 'warning')
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(content)
        self.log("📋 Анализ скопирован!", 'success')
    
    def export_analysis(self):
        content = self.analyzer_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Сначала выполните анализ!", 'warning')
            return
        path = filedialog.asksaveasfilename(
            title="Сохранить анализ",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("JSON files", "*.json")]
        )
        if not path:
            return
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            self.log(f"💾 Анализ сохранён: {Path(path).name}", 'success')
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
    
    def copy_errors(self):
        if not self.error_log:
            self.root.clipboard_clear()
            self.root.clipboard_append("✅ Ошибок нет!")
            self.log("📋 Скопировано: ошибок нет", 'info')
            return
        text = "=" * 50 + "\n"
        text += "⚠️ ЛОГ ОШИБОК\n"
        text += "=" * 50 + "\n"
        text += f"Всего: {len(self.error_log)} ошибок\n\n"
        for i, err in enumerate(self.error_log, 1):
            text += f"{i:3d}. ❌ {err}\n"
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self.log(f"📋 Скопировано {len(self.error_log)} ошибок", 'success')
    
    # ========================================================================
    # ИСТОРИЯ
    # ========================================================================
    
    def undo(self):
        if not self.undo_stack:
            self.log("⚠️ Нет действий для отмены", 'warning')
            return
        current = self.code_text.get('1.0', 'end-1c')
        self.redo_stack.append(current)
        previous = self.undo_stack.pop()
        self.code_text.delete('1.0', 'end')
        self.code_text.insert('1.0', previous)
        self.log("↩ Отменено последнее действие", 'info')
    
    def redo(self):
        if not self.redo_stack:
            self.log("⚠️ Нет действий для повтора", 'warning')
            return
        current = self.code_text.get('1.0', 'end-1c')
        self.undo_stack.append(current)
        next_action = self.redo_stack.pop()
        self.code_text.delete('1.0', 'end')
        self.code_text.insert('1.0', next_action)
        self.log("↪ Повторено действие", 'info')
    
    def save_state(self):
        content = self.code_text.get('1.0', 'end-1c')
        self.undo_stack.append(content)
        self.redo_stack.clear()
        if len(self.undo_stack) > self.max_history:
            self.undo_stack = self.undo_stack[-self.max_history:]
    
    def add_history_entry(self, entry: str):
        timestamp = datetime.now().strftime('%H:%M:%S')
        self.history_listbox.insert(0, f"[{timestamp}] {entry}")
        if self.history_listbox.size() > 100:
            self.history_listbox.delete(100, 'end')
    
    def clear_history(self):
        if messagebox.askyesno("Очистка истории", "Удалить всю историю?"):
            self.history_listbox.delete(0, 'end')
            self.log("🧹 История очищена", 'info')
    
    def copy_history(self):
        history = self.history_listbox.get(0, 'end')
        if not history:
            self.log("⚠️ История пуста", 'warning')
            return
        text = "📜 ИСТОРИЯ ОПЕРАЦИЙ\n" + "=" * 50 + "\n\n"
        text += "\n".join(history)
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self.log("📋 История скопирована", 'success')
    
    # ========================================================================
    # ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    # ========================================================================
    
    def update_line_info(self, event=None):
        try:
            cursor_pos = self.code_text.index(tk.INSERT)
            line, col = cursor_pos.split('.')
            self.line_info.config(text=f"Строка: {line} | Столбец: {int(col) + 1}")
        except:
            pass
    
    def update_file_info(self):
        path = self.file_path.get()
        if not path or not os.path.exists(path):
            self.file_info_label.config(text="📊 Хеш: — | Строк: — | Размер: —")
            return
        info = FileInfo(
            path=path,
            hash=self.file_manager.get_file_hash(path),
            lines=len(self.current_content.split('\n')) if self.current_content else 0,
            has_bom=False,
            size=os.path.getsize(path)
        )
        self.file_info_label.config(
            text=f"📊 Хеш: {info.hash} | Строк: {info.lines:,} | Размер: {info.size:,} байт"
        )
    
    def update_error_button(self):
        count = len(self.error_log)
        if count > 0:
            self.error_button.config(
                text=f"⚠️ Ошибок: {count}",
                bg='#6a2d2d',
                fg='#ffffff',
                relief='raised'
            )
        else:
            self.error_button.config(
                text="✅ Ошибок: 0",
                bg='#2d2d2d',
                fg='#4ec9b0',
                relief='flat'
            )
    
    def show_progress(self, message: str = "Обработка..."):
        self.progress_frame.pack(fill='x', pady=(0, 5))
        self.progress_label.config(text=message)
        self.progress_bar.start()
        self.root.update()
    
    def hide_progress(self):
        self.progress_bar.stop()
        self.progress_frame.pack_forget()
        self.root.update()
    
    def restore_backup(self):
        backups = self.file_manager.get_backups()
        if not backups:
            self.log("⚠️ Нет бэкапов!", 'warning')
            return
        backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        dialog = tk.Toplevel(self.root)
        dialog.title("Восстановление из бэкапа")
        dialog.geometry("500x300")
        dialog.configure(bg='#1e1e1e')
        dialog.transient(self.root)
        dialog.grab_set()
        ttk.Label(dialog, text="Выберите бэкап для восстановления:", 
                 style='Dark.TLabel').pack(pady=10)
        listbox = tk.Listbox(dialog, bg='#1e1e1e', fg='#d4d4d4',
                            selectbackground='#264f78', font=('Consolas', 10))
        listbox.pack(fill='both', expand=True, padx=10, pady=5)
        for backup in backups[:20]:
            timestamp = datetime.fromtimestamp(backup.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            listbox.insert('end', f"{timestamp} - {backup.name}")
        def do_restore():
            selection = listbox.curselection()
            if not selection:
                return
            backup = backups[selection[0]]
            if self.file_manager.restore_backup(self.file_path.get(), backup):
                content, _ = self.file_manager.read_file(self.file_path.get())
                if content:
                    self.code_text.delete('1.0', 'end')
                    self.code_text.insert('1.0', content)
                    self.current_content = content
                    self.update_file_info()
                    self.save_state()
                    self.log(f"↩ Восстановлен бэкап: {backup.name}", 'success')
                    self.add_history_entry(f"↩ Восстановлен бэкап: {backup.name}")
                    dialog.destroy()
            else:
                self.log("❌ Ошибка восстановления!", 'error')
        btn_frame = ttk.Frame(dialog, style='Dark.TFrame')
        btn_frame.pack(fill='x', padx=10, pady=10)
        ttk.Button(btn_frame, text="↩ Восстановить", 
                  command=do_restore, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="❌ Отмена", 
                  command=dialog.destroy, style='Dark.TButton').pack(side='left', padx=2)
    
    def apply_and_run(self):
        self.apply_patch()
        self.run_file()
    
    def run_file(self):
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
        path = self.file_path.get()
        if not os.path.exists(path):
            self.log(f"❌ Файл не существует: {path}", 'error')
            return
        try:
            webbrowser.open(f'file://{os.path.abspath(path)}')
            self.log(f"▶ Запущен: {Path(path).name}", 'success')
            self.add_history_entry(f"▶ Запущен файл: {Path(path).name}")
        except Exception as e:
            self.log(f"❌ Ошибка запуска: {e}", 'error')
    
    # ========================================================================
    # ЛОГИРОВАНИЕ
    # ========================================================================
    
    def log(self, message: str, type: str = 'info'):
        timestamp = datetime.now().strftime('%H:%M:%S')
        self.log_text.insert('end', f"[{timestamp}] ", 'time')
        self.log_text.insert('end', message + '\n', type)
        self.log_text.see('end')
        self.status_label.config(text=message[:80])
    
    # ========================================================================
    # НАСТРОЙКИ
    # ========================================================================
    
    def load_settings(self):
        self.settings = {
            'auto_load_last': True,
            'last_file': '',
            'window_geometry': '1300x800'
        }
        if self.settings_file.exists():
            try:
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    self.settings.update(loaded)
            except:
                pass
    
    def save_settings(self):
        try:
            self.settings['window_geometry'] = self.root.geometry()
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, indent=2, ensure_ascii=False)
        except:
            pass
    
    # ========================================================================
    # ЗАПУСК
    # ========================================================================
    
    def run(self):
        try:
            self.root.mainloop()
        finally:
            self.save_settings()
    
    def on_closing(self):
        if messagebox.askokcancel("Выход", "Закрыть программу?"):
            self.save_settings()
            self.root.destroy()

# ============================================================================
# ТОЧКА ВХОДА
# ============================================================================

if __name__ == "__main__":
    app = AnalyzerPatcher()
    app.root.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.run()