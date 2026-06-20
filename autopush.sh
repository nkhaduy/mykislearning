#!/bin/bash
while true
do
    # Chỉ commit và push nếu thực sự có file thay đổi
    if [ -n "$(git status --porcelain)" ]; then
        git add .
        git commit -m "Auto-sync: $(date +'%Y-%m-%d %H:%M:%S')"
        git push origin main
        echo "=> Đã đồng bộ lên GitHub lúc $(date +'%H:%M:%S')"
    fi
    sleep 10
done
