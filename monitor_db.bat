@echo off
echo ====================================
echo MariaDB Real-time Monitor
echo ====================================
echo.
echo Portfolio Assets (Current Data):
"C:\Program Files\MariaDB 12.0\bin\mysql.exe" -u root -p1234 -e "USE qfn; SELECT id, portfolio_id, ticker, display_name, currency, quantity, purchase_price FROM portfolio_asset ORDER BY id DESC LIMIT 10;"
echo.
echo Total Counts:
"C:\Program Files\MariaDB 12.0\bin\mysql.exe" -u root -p1234 -e "USE qfn; SELECT 'Portfolios' as Type, COUNT(*) as Count FROM portfolio UNION ALL SELECT 'Assets' as Type, COUNT(*) as Count FROM portfolio_asset UNION ALL SELECT 'Stocks' as Type, COUNT(*) as Count FROM stocks;"
echo.
echo ====================================
echo Press any key to refresh...
pause > nul
cls
goto :EOF
