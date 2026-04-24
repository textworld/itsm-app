#!/bin/bash
# 全自动安装 ossutil 2.0 (Linux amd64)
set -e

echo "===== 开始安装 ossutil 2.0 ====="

# 1. 安装依赖 unzip
sudo apt update && sudo apt install -y unzip

# 2. 下载最新版 ossutil 2.0
wget -O ossutil2.zip https://gosspublic.alicdn.com/ossutil/v2/2.2.2/ossutil-2.2.2-linux-amd64.zip

# 3. 解压
unzip -o ossutil2.zip

# 4. 进入目录
cd ossutil-2.2.2-linux-amd64

# 5. 授权 + 全局安装
chmod +x ossutil
sudo mv ossutil /usr/local/bin/

# 6. 清理临时文件
cd ..
rm -rf ossutil2.zip ossutil-2.2.2-linux-amd64

# 7. 验证安装
echo "===== 安装完成，版本信息如下 ====="
ossutil --version
