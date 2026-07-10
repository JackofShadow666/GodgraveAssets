import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext, messagebox
import webbrowser
import os
import re
from pathlib import Path
from datetime import datetime

class RealPatcher:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("🔧 REAL Patcher v6.0")
        self.root.geometry("1100x650")
        
        self.file_path = tk.StringVar()
        self.backup_dir = Path("backups")
        self.backup_dir.mkdir(exist_ok=True)
        self.error_log = []
        
        self.setup_theme()
        self.create_widgets()
        
        self.root.bind('<Control-o>', lambda e: self.load_file())
        self.root.bind('<Control-r>', lambda e: self.apply_patch())
        
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
        ttk.Entry(top, textvariable=self.file_path, width=50).pack(side='left', padx=5)
        ttk.Button(top, text="📂 Открыть", command=self.load_file, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(top, text="↩ Откатить", command=self.restore_backup, style='Dark.TButton').pack(side='left', padx=2)
        
        self.status = ttk.Label(main, text="✅ Готов к работе", style='Dark.TLabel')
        self.status.pack(anchor='w', pady=(0, 10))
        
        paned = ttk.PanedWindow(main, orient='horizontal')
        paned.pack(fill='both', expand=True)
        
        left = ttk.Frame(paned, style='Dark.TFrame')
        paned.add(left, weight=1)
        
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
        ttk.Button(btn_frame, text="🔧 ПРИМЕНИТЬ И СОХРАНИТЬ", command=self.apply_patch, style='Dark.TButton').pack(side='left', padx=2)
        ttk.Button(btn_frame, text="📋 Вставить", command=self.paste_from_clipboard, style='Dark.TButton').pack(side='left', padx=2)
        
        right = ttk.Frame(paned, style='Dark.TFrame')
        paned.add(right, weight=2)
        
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
    
    def apply_patch(self):
        """Применяет патч и СОХРАНЯЕТ файл"""
        if not self.file_path.get():
            self.log("⚠️ Сначала загрузите файл!", 'warning')
            return
        
        patch = self.patch_text.get('1.0', 'end-1c').strip()
        if not patch:
            self.log("⚠️ Вставьте патч!", 'warning')
            return
        
        current = self.code_text.get('1.0', 'end-1c')
        self.error_log = []
        
        # Парсим патч
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
                    # Простая замена
                    if find_text in current:
                        current = current.replace(find_text, replace_text)
                        patches_applied += 1
                        self.log(f"✅ Найдено и заменено!", 'success')
                    else:
                        # Пробуем без пробелов
                        find_clean = find_text.strip()
                        for line_in_file in current.split('\n'):
                            if line_in_file.strip() == find_clean:
                                current = current.replace(line_in_file, replace_text)
                                patches_applied += 1
                                self.log(f"✅ Найдено и заменено (без пробелов)!", 'success')
                                break
                        else:
                            self.log(f"❌ НЕ НАЙДЕНО: {find_text[:40]}...", 'error')
                            self.error_log.append(f"Не найдено: {find_text[:60]}")
                    
                    find_text = None
                    replace_text = None
        
        if patches_applied:
            # Обновляем текст в поле
            self.code_text.delete('1.0', 'end')
            self.code_text.insert('1.0', current)
            
            # ✅ СОХРАНЯЕМ ФАЙЛ
            try:
                with open(self.file_path.get(), 'w', encoding='utf-8') as f:
                    f.write(current)
                self.log(f"💾 Файл СОХРАНЁН на диск!", 'success')
                self.log(f"✅ Применено {patches_applied} патчей", 'success')
            except Exception as e:
                self.log(f"❌ ОШИБКА СОХРАНЕНИЯ: {e}", 'error')
                messagebox.showerror("Ошибка", f"Не удалось сохранить файл!\n{e}")
        else:
            self.log("⚠️ Ничего не изменено", 'warning')
        
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
            
            self.code_text.delete('1.0', 'end')
            self.code_text.insert('1.0', content)
            
            backup_path = self.backup_dir / f"{Path(path).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            self.log(f"✅ Загружено: {path}", 'success')
            
        except Exception as e:
            self.log(f"❌ Ошибка: {e}", 'error')
    
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
            
            # Сохраняем восстановленный файл
            with open(self.file_path.get(), 'w', encoding='utf-8') as f:
                f.write(content)
            
            self.log(f"↩ Восстановлено и сохранено", 'success')
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
    app = RealPatcher()
    app.run()