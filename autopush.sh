#!/bin/bash

TARGET_DIR=$(pwd)

echo "=== ĐANG CANH THƯ MỤC CỦA BẠN TRÊN CODEX (MÁY MỚI) ==="
echo "Mọi thay đổi sẽ được đồng bộ lên GitHub ngay lập tức..."

# Kiểm tra nếu máy chưa cài fswatch thì dùng vòng lặp thường, nếu có thì dùng fswatch cho mượt
if command -v fswatch &> /dev/null; then
    fswatch -o -r "$TARGET_DIR" -e "/\.git" -e "autopush.sh" -e "autopush.bat" | while read num
    do
        if [ -n "$(git status --porcelain)" ]; then
            echo "Phát hiện thay đổi: Tiến hành đồng bộ..."
            git add .
            git commit -m "Auto-sync: $(date +'%Y-%m-%d %H:%M:%S')"
            git push origin main
            echo "=> Đã đẩy lên GitHub thành công!"
            echo "----------------------------------------"
        fi
    done
else
    # Vòng lặp 10 giây nếu máy chưa cài fswatch
    while true
    do
        if [ -n "$(git status --porcelain)" ]; then
            echo "Phát hiện thay đổi: Tiến hành đồng bộ..."
            git add .
            git commit -m "Auto-sync: $(date +'%Y-%m-%d %H:%M:%S')"
            git push origin main
            echo "=> Đã đẩy lên GitHub thành công!"
            echo "----------------------------------------"
        fi
        sleep 10
    done
fi
