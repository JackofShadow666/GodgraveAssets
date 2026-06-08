// build.js — копируешь в папку Godgrave и запускаешь
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// ========== КОНФИГ ==========
const SOURCE = './Source';
const BUILD = './Build';

// Категории ассетов (папки внутри Source и Build)
const CATEGORIES = ['CharacterSet', 'Monsters', 'UI', 'Effects', 'Weapons'];

// ========== ОСНОВНАЯ ФУНКЦИЯ ==========
async function processImage(inputPath, outputPath) {
    const img = await loadImage(inputPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    
    // 1. Ищем маркер (255,0,255 — маджента)
    let markerX = -1, markerY = -1;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            if (data[idx] === 255 && data[idx+1] === 0 && data[idx+2] === 255 && data[idx+3] > 200) {
                markerX = x;
                markerY = y;
                break;
            }
        }
        if (markerX !== -1) break;
    }
    
    // 2. Если нет маркера — копируем как есть
    if (markerX === -1) {
        console.log(`   ⚠️ Нет маркера, копирую как есть`);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        return {
            pivotX: Math.floor(img.width / 2),
            pivotY: Math.floor(img.height / 2),
            width: img.width,
            height: img.height
        };
    }
    
    // 3. Делаем маркер временно видимым
    const markerIdx = (markerY * img.width + markerX) * 4;
    data[markerIdx+3] = 255;
    ctx.putImageData(imageData, 0, 0);
    
    // 4. Находим границы спрайта
    let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            if (data[idx+3] > 0) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    // 5. Обрезаем
    const croppedWidth = maxX - minX + 1;
    const croppedHeight = maxY - minY + 1;
    const croppedCanvas = createCanvas(croppedWidth, croppedHeight);
    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCtx.drawImage(canvas, minX, minY, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
    
    // 6. Удаляем маркер
    const croppedData = croppedCtx.getImageData(0, 0, croppedWidth, croppedHeight);
    const newMarkerX = markerX - minX;
    const newMarkerY = markerY - minY;
    const markerIdxNew = (newMarkerY * croppedWidth + newMarkerX) * 4;
    croppedData.data[markerIdxNew+3] = 0;
    croppedCtx.putImageData(croppedData, 0, 0);
    
    // 7. Сохраняем
    const buffer = croppedCanvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    return {
        pivotX: newMarkerX,
        pivotY: newMarkerY,
        width: croppedWidth,
        height: croppedHeight
    };
}

async function build() {
    console.log('\n⚔️ GODGRAVE BUILD\n');
    
    for (const category of CATEGORIES) {
        const sourceDir = path.join(SOURCE, category);
        const buildDir = path.join(BUILD, category);
        
        // Проверяем, существует ли папка источника
        if (!fs.existsSync(sourceDir)) {
            console.log(`⚠️ Нет папки: ${category} — пропускаем`);
            continue;
        }
        
        // Создаём папку назначения
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }
        
        // Получаем список PNG
        const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.png'));
        
        if (files.length === 0) {
            console.log(`📁 ${category}: нет PNG`);
            continue;
        }
        
        console.log(`\n📁 ${category} (${files.length} файлов)`);
        
        const meta = {};
        
        for (const file of files) {
            const id = file.replace('.png', '');
            const inputPath = path.join(sourceDir, file);
            const outputPath = path.join(buildDir, file);
            
            process.stdout.write(`   ${file} ... `);
            
            try {
                const result = await processImage(inputPath, outputPath);
                meta[id] = result;
                console.log(`✅ (${result.width}x${result.height})`);
            } catch(e) {
                console.log(`❌ Ошибка: ${e.message}`);
            }
        }
        
        // Сохраняем метаданные
        const metaPath = path.join(buildDir, `${category}.json`);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        console.log(`   📄 Сохранено: ${category}.json`);
    }
    
    console.log('\n✅ ГОТОВО!\n');
}

// ЗАПУСК
build().catch(console.error);