# Dockerfile

# 使用官方的 Node.js LTS 镜像作为基础
FROM node:lts-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json (如果存在)
# 这有助于 Docker 利用缓存，如果依赖没有变化，就不重新安装
COPY package*.json ./

# 安装项目依赖
# --omit=dev 将跳过开发依赖，减小镜像大小
RUN npm install --omit=dev

# 复制所有项目文件到工作目录
COPY . .

# 暴露应用程序运行的端口
EXPOSE 3000

ENV PROXY_URL="http://192.168.1.178:1080"

# 定义容器启动时运行的命令
# npm start 会根据 package.json 中的 "scripts": { "start": "node server.js" } 运行
CMD ["npm", "start"]

#http://localhost:3000/transcript/6gQGB6lpRYs?lang=ru

#docker build -t land007/ccdownload:latest .
