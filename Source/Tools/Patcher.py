import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext, messagebox
import webbrowser
import os
import re
import hashlib
from pathlib import Path
from datetime import datetime
import json

class AnalyzerPatcher:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("🔧 Analyzer Patcher v9.0")
        self.root.geometry("1200x750")
        
        self.file_path = tk.StringVar()
        self.backup_dir = Path("backups")
        self.backup_dir.mkdir(exist_ok=True)
        self.error_log = []
        self.current_content = ""
        
        self.original_hash = None
        
        self.setup_theme()
        self.create_widgets()
        
        self.root.bind('<Control-o>', lambda e: self.load_file())
        self.root.bind('<Control-r>', lambda e: self.apply_patch())
        self.root.bind('<Control-a>', lambda e: self.analyze_file())
        
    def setup_theme(self):
        self.root.configure(bg='#1e1e1e')
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('Dark.TFrame', background='#1e1e1e')
        style.configure('Dark.TLabel', background='#1e1e1e', foreground='#d4d4d4')
        style.configure('Dark.TButton', background='#2d2d2d', foreground='#d4d4d4')
        
    def create_widgets(self):
        main = ttk.Frame(self.root, style='Dark.TFrame')
        main.pack(fill='both', expand=True, padx=10, pady=10)
        
        top = ttk.Frame(main, style='Dark.TFrame')
        top.pack(fill='x', pady=(0, 10))
        
        ttk.Label(top, text="📄 Файл:", style='Dark.TLabel').pack(side='left')
        ttk.Entry(top, textvariable=self.file_path, width=45).pack(side='left', padx=5)
        ttk.Button(top, text="📂 Открыть", command=self.load_file, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(top, text="💾 Сохранить", command=self.save_file, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(top, text="↩ Откатить", command=self.restore_backup, style='Dark.TButton').pack(side='left', padx=2)
        
        self.file_info = ttk.Label(main, text="📊 Хеш: — | BOM: — | Строк: —", style='Dark.TLabel')
        self.file_info.pack(anchor='w', pady=(0, 10))
        
        self.status = ttk.Label(main, text="✅ Готов к работе", style='Dark.TLabel')
        self.status.pack(anchor='w', pady=(0, 10))
        
        # Главный контейнер с вкладками
        notebook = ttk.Notebook(main)
        notebook.pack(fill='both', expand=True)
        
        # Вкладка 1: Редактор
        editor_frame = ttk.Frame(notebook, style='Dark.TFrame')
        notebook.add(editor_frame, text="📝 Редактор")
        
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
        
        btn_frame = ttk.Frame(left, style='Dark.TFrame')
        btn_frame.pack(fill='x', pady=(5, 0))
        ttk.Button(btn_frame, text="🔧 ПРИМЕНИТЬ", command=self.apply_patch, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="📋 Вставить", command=self.paste_from_clipboard, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="🔍 Анализ", command=self.analyze_file, style='Dark.TButton').pack(side='left', padx=2)
        
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
        
        # Вкладка 2: Анализатор
        analyzer_frame = ttk.Frame(notebook, style='Dark.TFrame')
        notebook.add(analyzer_frame, text="🔍 Анализатор")
        
        self.analyzer_text = scrolledtext.ScrolledText(
            analyzer_frame,
            bg='#1e1e1e',
            fg='#d4d4d4',
            insertbackground='#d4d4d4',
            font=('Consolas', 10),
            wrap='word'
        )
        self.analyzer_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        analyzer_btn_frame = ttk.Frame(analyzer_frame, style='Dark.TFrame')
        analyzer_btn_frame.pack(fill='x', padx=10, pady=(0, 10))
        ttk.Button(analyzer_btn_frame, text="📋 Копировать анализ", command=self.copy_analysis, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(analyzer_btn_frame, text="🔄 Обновить", command=self.analyze_file, style='Dark.TButton').pack(side='left', padx=2)
        
        # Нижняя панель
        bottom = ttk.Frame(main, style='Dark.TFrame')
        bottom.pack(fill='x', pady=(10, 0))
        
        ttk.Button(bottom, text="🚀 Применить и запустить", command=self.apply_and_run, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(bottom, text="▶ Запустить", command=self.run_file, style='Dark.TButton').pack(side='left', padx=2)
        
        self.error_button = tk.Button(
            bottom,
            text="✅ Ошибок: 0",
            command=self.copy_errors,
            bg='#2d2d2d',
            fg='#4ec9b0',
            font=('Consolas', 10),
            relief='flat',
            padx=10,
            pady=5
        )
        self.error_button.pack(side='right', padx=2)
        
        self.log_text = scrolledtext.ScrolledText(
            main,
            height=4,
            bg='#1e1e1e',
            fg='#569cd6',
            font=('Consolas', 9)
        )
        self.log_text.pack(fill='x', pady=(5, 0))
    
    def analyze_file(self):
        """Анализирует структуру файла и показывает ключевые строки"""
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
        
        content = self.code_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Файл пуст!", 'warning')
            return
        
        self.analyzer_text.delete('1.0', 'end')
        
        # Информация о файле
        lines = content.split('\n')
        total_lines = len(lines)
        
        analysis = []
        analysis.append("=" * 60)
        analysis.append("📊 АНАЛИЗ ФАЙЛА")
        analysis.append("=" * 60)
        analysis.append(f"📄 Имя: {Path(self.file_path.get()).name}")
        analysis.append(f"📏 Всего строк: {total_lines}")
        analysis.append(f"📏 Всего символов: {len(content)}")
        analysis.append("")
        
        # Проверка BOM
        has_bom = content.startswith('\ufeff')
        analysis.append(f"🔤 BOM (Byte Order Mark): {'ЕСТЬ' if has_bom else 'НЕТ'}")
        analysis.append("")
        
        # Ключевые теги в конце файла
        analysis.append("=" * 60)
        analysis.append("🔍 ПОСЛЕДНИЕ 20 СТРОК ФАЙЛА:")
        analysis.append("=" * 60)
        
        start_line = max(0, total_lines - 20)
        for i in range(start_line, total_lines):
            line_num = i + 1
            line_content = lines[i]
            # Показываем номера строк
            analysis.append(f"{line_num:4d} | {line_content}")
        
        analysis.append("")
        analysis.append("=" * 60)
        analysis.append("🔍 ПОИСК УНИКАЛЬНЫХ СТРОК (для патчей):")
        analysis.append("=" * 60)
        
        # Ищем уникальные строки (встречаются 1 раз)
        from collections import Counter
        line_counter = Counter(lines)
        unique_lines = [line for line, count in line_counter.items() if count == 1 and len(line.strip()) > 5]
        
        # Показываем первые 10 уникальных строк
        analysis.append("Уникальные строки (встречаются 1 раз):")
        for i, line in enumerate(unique_lines[:10], 1):
            preview = line[:80] + "..." if len(line) > 80 else line
            analysis.append(f"  {i}. {preview}")
        
        analysis.append("")
        analysis.append("=" * 60)
        analysis.append("🔍 КОНЕЦ ФАЙЛА (последние 3 строки с номерами):")
        analysis.append("=" * 60)
        
        for i in range(max(0, total_lines - 3), total_lines):
            line_num = i + 1
            analysis.append(f"{line_num:4d} | {lines[i]}")
        
        analysis.append("")
        analysis.append("=" * 60)
        analysis.append("💡 СОВЕТЫ ДЛЯ ПОИСКА:")
        analysis.append("=" * 60)
        analysis.append("1. Ищите УНИКАЛЬНЫЕ строки (встречаются 1 раз)")
        analysis.append("2. Используйте строки с номерами из списка выше")
        analysis.append("3. Для вставки в конец файла ищите: </script> или </body>")
        analysis.append("4. Проверьте, есть ли BOM в файле (если есть - удалите)")
        analysis.append("")
        analysis.append("=" * 60)
        
        # Вставляем анализ
        self.analyzer_text.insert('1.0', '\n'.join(analysis))
        self.log("✅ Анализ завершён! Перейдите на вкладку '🔍 Анализатор'", 'success')
        
        # Переключаемся на вкладку анализатора
        self.analyzer_text.master.master.select(1)
    
    def copy_analysis(self):
        """Копирует анализ в буфер обмена"""
        content = self.analyzer_text.get('1.0', 'end-1c')
        if not content:
            self.log("⚠️ Сначала выполните анализ!", 'warning')
            return
        
        self.root.clipboard_clear()
        self.root.clipboard_append(content)
        self.log("📋 Анализ скопирован в буфер!", 'success')
    
    def has_bom(self, content):
        return content.startswith('\ufeff')
    
    def get_file_hash(self, filepath):
        try:
            with open(filepath, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()[:16]
        except:
            return None
    
    def load_file(self):
        path = filedialog.askopenfilename(
            title="Выберите файл",
            filetypes=[("HTML files", "*.html"), ("All files", "*.*")]
        )
        if not path:
            return
        
        self.file_path.set(path)
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            
            # Удаляем BOM
            content_clean = content[1:] if content.startswith('\ufeff') else content
            self.current_content = content_clean
            
            self.code_text.delete('1.0', 'end')
            self.code_text.insert('1.0', content_clean)
            
            self.original_hash = self.get_file_hash(path)
            
            lines = len(content_clean.split('\n'))
            has_bom = content.startswith('\ufeff')
            self.file_info.config(
                text=f"📊 Хеш: {self.original_hash} | BOM: {'ЕСТЬ' if has_bom else 'НЕТ'} | Строк: {lines}"
            )
            
            backup_path = self.backup_dir / f"{Path(path).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content_clean)
            
            self.log(f"✅ Загружено: {path}", 'success')
            if has_bom:
                self.log(f"⚠️ Обнаружен BOM! Будет удалён при сохранении", 'warning')
            
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
    
    def save_file(self):
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
        
        try:
            content = self.code_text.get('1.0', 'end-1c')
            with open(self.file_path.get(), 'w', encoding='utf-8') as f:
                f.write(content)
            
            new_hash = self.get_file_hash(self.file_path.get())
            self.log(f"💾 Сохранено", 'success')
            self.file_info.config(
                text=f"📊 Хеш: {new_hash} | BOM: НЕТ | Строк: {len(content.split('\n'))}"
            )
            
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
        
        current = self.code_text.get('1.0', 'end-1c')
        self.error_log = []
        
        before_hash = self.get_file_hash(self.file_path.get())
        self.log(f"📊 ДО: хеш={before_hash}", 'info')
        
        lines = patch.split('\n')
        find_text = None
        replace_text = None
        patches_applied = 0
        
        self.log("🔍 Поиск строк для замены...", 'info')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if re.match(r'(найти|find)\s*[:;]\s*', line, re.IGNORECASE):
                find_text = re.sub(r'(найти|find)\s*[:;]\s*', '', line, flags=re.IGNORECASE).strip()
                self.log(f"🔍 Ищем: {find_text[:40]}...", 'info')
                continue
            
            if re.match(r'(заменить|replace)\s*[:;]\s*', line, re.IGNORECASE):
                replace_text = re.sub(r'(заменить|replace)\s*[:;]\s*', '', line, flags=re.IGNORECASE).strip()
                
                if find_text and replace_text:
                    if find_text in current:
                        current = current.replace(find_text, replace_text)
                        patches_applied += 1
                        self.log(f"✅ Найдено и заменено!", 'success')
                    else:
                        find_clean = find_text.strip()
                        found = False
                        for line_in_file in current.split('\n'):
                            if line_in_file.strip() == find_clean:
                                current = current.replace(line_in_file, replace_text)
                                patches_applied += 1
                                self.log(f"✅ Найдено и заменено (без пробелов)!", 'success')
                                found = True
                                break
                        
                        if not found:
                            self.log(f"❌ НЕ НАЙДЕНО: {find_text[:40]}...", 'error')
                            self.error_log.append(f"Не найдено: {find_text[:60]}")
                    
                    find_text = None
                    replace_text = None
        
        if patches_applied:
            self.code_text.delete('1.0', 'end')
            self.code_text.insert('1.0', current)
            
            try:
                with open(self.file_path.get(), 'w', encoding='utf-8') as f:
                    f.write(current)
                
                after_hash = self.get_file_hash(self.file_path.get())
                self.log(f"📊 ПОСЛЕ: хеш={after_hash}", 'info')
                
                if before_hash != after_hash:
                    self.log(f"✅ Файл ИЗМЕНИЛСЯ!", 'success')
                    self.log(f"✅ Применено {patches_applied} патчей", 'success')
                    self.file_info.config(
                        text=f"📊 Хеш: {after_hash} | BOM: НЕТ | Строк: {len(current.split('\n'))}"
                    )
                    messagebox.showinfo("✅ Успех", f"Файл изменён!\nХеш был: {before_hash}\nХеш стал: {after_hash}")
                else:
                    self.log(f"⚠️ Хеш НЕ ИЗМЕНИЛСЯ", 'warning')
                    messagebox.showwarning("⚠️ Внимание", "Файл не изменился.\n\nСовет: Нажмите '🔍 Анализ' чтобы увидеть структуру файла.")
                    
            except Exception as e:
                self.log(f"❌ ОШИБКА СОХРАНЕНИЯ: {e}", 'error')
        else:
            self.log("⚠️ Ничего не изменено", 'warning')
            messagebox.showinfo("ℹ️ Информация", "Патч не нашёл ни одной строки.\n\nНажмите '🔍 Анализ' чтобы увидеть структуру файла.")
        
        self.update_error_button()
    
    def log(self, message, type='info'):
        timestamp = datetime.now().strftime('%H:%M:%S')
        colors = {'info': '#569cd6', 'success': '#4ec9b0', 'warning': '#dcdcaa', 'error': '#f44747'}
        self.log_text.insert('end', f"[{timestamp}] ", 'time')
        self.log_text.insert('end', message + '\n', type)
        self.log_text.see('end')
        self.status.config(text=message[:60])
    
    def update_error_button(self):
        count = len(self.error_log)
        if count > 0:
            self.error_button.config(
                text=f"⚠️ Ошибок: {count}",
                bg='#8b0000',
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
    
    def copy_errors(self):
        if not self.error_log:
            self.root.clipboard_clear()
            self.root.clipboard_append("✅ Ошибок нет!")
            return
        
        text = "=" * 50 + "\n"
        text += "⚠️ ОШИБКИ\n"
        text += "=" * 50 + "\n\n"
        for i, err in enumerate(self.error_log, 1):
            text += f"{i}. ❌ {err}\n"
        
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("📋 Готово", "Лог ошибок скопирован!")
    
    def paste_from_clipboard(self):
        try:
            text = self.root.clipboard_get()
            if text:
                self.patch_text.delete('1.0', 'end')
                self.patch_text.insert('1.0', text)
                self.log("📋 Вставлено из буфера", 'info')
        except:
            self.log("⚠️ Буфер пуст", 'warning')
    
    def restore_backup(self):
        backups = list(self.backup_dir.glob("*.backup"))
        if not backups:
            self.log("⚠️ Нет бэкапов!", 'warning')
            return
        
        latest = max(backups, key=lambda x: x.stat().st_mtime)
        try:
            with open(latest, 'r', encoding='utf-8') as f:
                content = f.read()
            self.code_text.delete('1.0', 'end')
            self.code_text.insert('1.0', content)
            
            with open(self.file_path.get(), 'w', encoding='utf-8') as f:
                f.write(content)
            
            self.log(f"↩ Восстановлено", 'success')
            self.file_info.config(
                text=f"📊 Хеш: {self.get_file_hash(self.file_path.get())} | BOM: НЕТ | Строк: {len(content.split('\n'))}"
            )
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
    
    def apply_and_run(self):
        self.apply_patch()
        self.run_file()
    
    def run_file(self):
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
        webbrowser.open(f'file://{os.path.abspath(self.file_path.get())}')
        self.log("▶ Запущено", 'success')
    
    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = AnalyzerPatcher()
    app.run()