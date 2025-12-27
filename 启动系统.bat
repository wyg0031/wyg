@echo off
chcp 65001 >nul
echo ========================================
echo 人员管理系统 - 安装和启动脚本
echo ========================================
echo.

echo [1/3] 检查Node.js安装状态...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js！
    echo.
    echo 请先安装Node.js：
    echo 1. 访问 https://nodejs.org/
    echo 2. 下载并安装LTS版本
    echo 3. 安装完成后重新运行此脚本
    echo.
    pause
    exit /b 1
)

echo [成功] Node.js已安装
node --version
echo.

echo [2/3] 安装项目依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败！
    pause
    exit /b 1
)

echo [成功] 依赖安装完成
echo.

echo [3/3] 启动服务器...
echo.
echo ========================================
echo 系统正在启动...
echo 请在浏览器中打开: http://localhost:3000
echo.
echo 默认管理员账号: admin
echo 默认密码: admin123
echo.
echo 按 Ctrl+C 可停止服务器
echo ========================================
echo.

call npm start

pause
