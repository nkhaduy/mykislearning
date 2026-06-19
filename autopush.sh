#!/bin/bash

TARGET_DIR=$(pwd)

echo "=== ĐANG CANH THƯ MỤC CỦA BẠN TRÊN CODEX ==="
echo "Mọi thay đổi sẽ được đồng bộ lên GitHub ngay lập tức..."

fswatch -o -r "$TARGET_DIR" -e "/\.git" -e "autopush.sh" | while read num
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
