#!/bin/bash

# Thư mục hiện tại
TARGET_DIR=$(pwd)

echo "=== ĐANG CANH THƯ MỤC CỦA BẠN TRÊN CODEX ==="
echo "Mọi thay đổi sẽ được đồng bộ lên GitHub ngay lập tức..."

# Dùng fswatch để bắt sự kiện thay đổi file (loại trừ thư mục .git và chính file script)
fswatch -o -r "$TARGET_DIR" -e "/\.git" -e "autopush.sh" | while read num
do
    # Kiểm tra xem thực sự có file nào thay đổi không
    if [ -n "$(git status --porcelain)" ]; then
        echo "发现 Thay đổi: Tiến hành đồng bộ..."
        git add .
        git commit -m "Auto-sync: $(date +'%Y-%m-%d %H:%M:%S')"
        git push origin main
        echo "=> Đã đẩy lên GitHub thành công!"
        echo "----------------------------------------"
    fi
done
