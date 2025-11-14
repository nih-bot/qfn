import { useState, useEffect, useCallback } from 'react';
// import { useTranslation } from 'react-i18next'; // t 함수가 사용되지 않으므로 주석 처리
import axios from 'axios';
import { Plus, Trash2, TrendingUp, RefreshCw, Bot, Save } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid } from 'recharts';
import StockSearchInput from './StockSearchInput';

const PortfolioOptimizer = () => {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  // const [riskLevel, setRiskLevel] = useState(5); // 사용되지 않으므로 주석 처리
  const [totalInvestment, setTotalInvestment] = useState(10000000);
  const [targetRiskLevel, setTargetRiskLevel] = useState(5);
  const [targetReturn, setTargetReturn] = useState(10);
  const [dataPeriod, setDataPeriod] = useState('1년');
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [constraints, setConstraints] = useState({});
  const [exchangeRate, setExchangeRate] = useState({ rate: 1456, timestamp: 0 });
  const [exchangeRateError, setExchangeRateError] = useState('');
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  // 환율 조회
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await axios.get('/api/exchange/usd-krw');
        if (response.data.success || response.data.rate > 0) {
          setExchangeRate({
            rate: response.data.rate,
            timestamp: response.data.timestamp || Date.now()
          });
          setExchangeRateError('');
          console.log(`💱 환율 업데이트: ₩${response.data.rate.toFixed(2)} (${response.data.message || '실시간'})`);
        } else {
          setExchangeRateError(response.data.message || '환율 조회 실패, 기본값 사용');
          console.warn('⚠️ 환율 조회 실패, 기본값 사용:', response.data.message);
        }
      } catch (error) {
        setExchangeRateError('환율 API 오류: ' + (error.message || '알 수 없는 오류'));
        console.error('❌ 환율 조회 오류:', error.message);
        // 에러 발생 시 기본값 유지 (초기값 1456)
      }
    };

    fetchExchangeRate();
    const interval = setInterval(fetchExchangeRate, 86400000); // 24시간마다 갱신 (API 제한 방지)
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const optimizationStocks = localStorage.getItem('optimizationStocks');
    if (optimizationStocks) {
      try {
        const userStocks = JSON.parse(optimizationStocks);
        console.log('📦 [Optimizer] localStorage 데이터 로드:', userStocks);
        console.log('🆕 [Optimizer] Bundle marker:', {
          BUILD_JS: 'index-DBoZMK54.js',
          BUILD_VERSION: 'v3',
          LOAD_TIMESTAMP: new Date().toISOString()
        });
        const mergedStocks = {};
        
        userStocks.forEach(stock => {
          const ticker = stock.ticker;
          
          if (mergedStocks[ticker]) {
            const existing = mergedStocks[ticker];
            const totalQuantity = existing.quantity + stock.quantity;
            const totalInvestment = (existing.purchasePrice * existing.quantity) + (stock.purchasePrice * stock.quantity);
            const avgPurchasePrice = totalInvestment / totalQuantity;
            
            mergedStocks[ticker] = {
              ...existing,
              quantity: totalQuantity,
              purchasePrice: avgPurchasePrice,
              investmentAmount: avgPurchasePrice * totalQuantity  // 평균 매수가 * 총 수량
            };
          } else {
            mergedStocks[ticker] = {
              symbol: ticker,
              name: stock.name,
              market: ticker.includes('.KS') || ticker.includes('.KQ') ? 'DOMESTIC' : 'FOREIGN',
              quantity: stock.quantity,
              currentPrice: stock.currentPrice,
              purchasePrice: stock.purchasePrice,
              investmentAmount: stock.purchasePrice * stock.quantity, // 매수가 * 수량 = 투자 금액
              riskLevel: 5
            };
          }
        });
        
        const convertedStocks = Object.values(mergedStocks);
        console.log('✅ [Optimizer] 병합 완료:', convertedStocks);
        setStocks(convertedStocks);
        localStorage.removeItem('optimizationStocks');
      } catch (error) {
        console.error('❌ [Optimizer] Stock load error:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStockPrices = useCallback(async () => {
    if (stocks.length === 0) return;

    setPriceLoading(true);
    try {
      const updatedStocks = await Promise.all(
        stocks.map(async (stock) => {
          try {
            const response = await axios.get(`/api/portfolio/stock-price/${stock.symbol}`);
            const newPrice = response.data.currentPrice;
            return {
              ...stock,
              currentPrice: newPrice
            };
          } catch (error) {
            console.error('Error fetching stock price:', error);
            return stock;
          }
        })
      );
      setStocks(updatedStocks);
      setLastPriceUpdate(Date.now());
    } catch (error) {
      console.error('Error updating stock prices:', error);
    } finally {
      setPriceLoading(false);
    }
  }, [stocks]);

  useEffect(() => {
    const total = stocks.reduce((sum, stock) => sum + stock.investmentAmount, 0);
    setTotalInvestment(total);
  }, [stocks]);

  const handleOptimize = async () => {
    if (stocks.length < 2) {
      alert('최소 2개 이상의 종목이 필요합니다.');
      return;
    }

    setLoading(true);
    try {
      const stockData = stocks.map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        quantity: stock.quantity,
        purchasePrice: stock.purchasePrice,
        currentPrice: stock.currentPrice,
        weight: stock.investmentAmount / totalInvestment
      }));

      const response = await axios.post('/api/portfolio/optimize', {
        sessionId: sessionId, // AI 요약을 위한 세션 ID
        stocks: stockData,
        targetReturn: targetReturn,
        riskLevel: targetRiskLevel,
        dataPeriod: dataPeriod,
        optimizationMethod: 'QAOA', // QAOA로 고정
        useRealData: true, // 항상 실시간 데이터 사용
        constraints: constraints
      });

      // Transform allocation object to optimalWeights array
      const result = response.data;
      if (result.allocation) {
        result.optimalWeights = Object.entries(result.allocation).map(([symbol, percentage]) => {
          const stock = stocks.find(s => s.symbol === symbol);
          return {
            name: stock?.name || symbol,
            symbol: symbol,
            value: percentage / 100 // Convert percentage to decimal
          };
        });
      }

      setOptimizationResult(result);
      
      // AI 자동 요약 가져오기
      try {
        const summaryResponse = await axios.get(`/api/chatbot/summary/${sessionId}`);
        if (summaryResponse.data && summaryResponse.data.response) {
          setAiSummary(summaryResponse.data.response);
        }
      } catch (summaryError) {
        console.error('Error fetching AI summary:', summaryError);
      }
    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      alert('최적화 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // AI 자동 요약 가져오기 (추가 예정)
  const fetchAISummary = async () => {
    try {
      const response = await axios.get(`/api/chatbot/summary/${sessionId}`);
      setAiSummary(response.data.message);
    } catch (error) {
      console.error('Error fetching AI summary:', error);
      setAiSummary('요약을 생성할 수 없습니다.');
    }
  };

  const handleSavePortfolio = async () => {
    if (!saveName.trim()) {
      alert('포트폴리오 이름을 입력해주세요.');
      return;
    }

    if (!optimizationResult || !optimizationResult.optimalWeights) {
      alert('먼저 포트폴리오를 최적화해주세요.');
      return;
    }

    try {
      // 최적화된 가중치에 따라 새로운 자산 목록 생성 (백엔드 DTO에 맞춤)
      const totalCurrentValue = stocks.reduce((sum, stock) => sum + stock.currentPrice * stock.quantity, 0);
      
      const newAssets = optimizationResult.optimalWeights.map(optimizedStock => {
        const originalStock = stocks.find(s => s.symbol === optimizedStock.symbol);
        const newInvestment = totalCurrentValue * optimizedStock.value;
        const unitPrice = originalStock?.currentPrice || 0;
        const newQuantity = unitPrice > 0 ? (newInvestment / unitPrice) : 0;
        const isDomestic = optimizedStock.symbol.endsWith('.KS') || optimizedStock.symbol.endsWith('.KQ');

        return {
          ticker: optimizedStock.symbol,
          displayName: optimizedStock.name,
          currency: isDomestic ? 'KRW' : 'USD',
          quantity: Number(newQuantity.toFixed(6)),
          purchasePrice: Number(unitPrice.toFixed(2)),
          // 가중치 관련 필드는 기본값 사용 (백엔드에서 Builder Default 처리)
        };
      });

      const portfolioData = {
        name: saveName,
        baseCurrency: 'KRW',
        totalBudget: Number(totalCurrentValue.toFixed(2)),
        assets: newAssets
      };

      const response = await axios.post('/api/portfolios', portfolioData);
      console.log('✅ [PortfolioOptimizer] 포트폴리오 저장 성공:', response.data);
      
      alert('최적화된 포트폴리오가 저장되었습니다.');
      
      // 저장 성공 알림: 마이페이지에서 자동 재조회하도록 이벤트 송신
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📢 [PortfolioOptimizer] portfolio:saved 이벤트 발송!');
      console.log('📦 portfolioId:', response.data.id);
      console.log('📦 portfolioName:', response.data.name);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const event = new CustomEvent('portfolio:saved', {
        detail: { 
          portfolioId: response.data.id,
          portfolioName: response.data.name,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
      console.log('✅ [PortfolioOptimizer] 이벤트 발송 완료');
      
      setShowSaveModal(false);
      setSaveName('');
    } catch (error) {
      console.error('❌ 포트폴리오 저장 실패:', error);
      alert('저장 중 오류가 발생했습니다: ' + (error.response?.data || error.message));
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // 주식 선택 핸들러
  const handleSelectStock = async (stock) => {
    console.log('📌 선택된 종목:', stock);
    setSelectedStock(stock);
    setPriceLoading(true);
    
    try {
      // 실시간 주가 조회
      const response = await axios.get(`/api/portfolio/stock-price/${stock.symbol}`);
      const price = response.data.currentPrice || response.data.price || 0;
      
      setCurrentPrice(price);
      setPurchasePrice(price); // 매입가도 현재가로 자동 설정
      console.log(`✅ 주가 조회 성공: ${stock.symbol} = ₩${price}`);
    } catch (error) {
      console.error('❌ 주가 조회 실패:', error);
      setCurrentPrice(0);
      setPurchasePrice(0);
      alert('주가를 조회할 수 없습니다. 수동으로 입력해주세요.');
    } finally {
      setPriceLoading(false);
      setLastPriceUpdate(new Date().toLocaleTimeString());
    }
  };

  // 종목 추가 핸들러
  const handleAddStock = () => {
    if (!selectedStock || !quantity || !purchasePrice) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    const newStock = {
      symbol: selectedStock.symbol,
      name: selectedStock.name,
      market: selectedStock.symbol.endsWith('.KS') || selectedStock.symbol.endsWith('.KQ') ? 'DOMESTIC' : 'FOREIGN',
      quantity: parseFloat(quantity),
      currentPrice: parseFloat(currentPrice) || parseFloat(purchasePrice),
      purchasePrice: parseFloat(purchasePrice),
      investmentAmount: parseFloat(purchasePrice) * parseFloat(quantity),
      riskLevel: 5
    };

    setStocks([...stocks, newStock]);
    setSelectedStock(null);
    setQuantity('');
    setPurchasePrice('');
    setCurrentPrice('');
    alert('✅ 종목이 추가되었습니다.');
  };

  // 종목 삭제 핸들러
  const handleRemoveStock = (symbol) => {
    if (window.confirm('해당 종목을 삭제하시겠습니까?')) {
      setStocks(stocks.filter(stock => stock.symbol !== symbol));
    }
  };

  const currentPortfolioStats = stocks.length > 0 && stocks.reduce((sum, stock) => sum + stock.investmentAmount, 0) > 0 ? {
    totalValue: stocks.reduce((sum, stock) => sum + (stock.currentPrice * stock.quantity), 0),
    totalCost: stocks.reduce((sum, stock) => sum + stock.investmentAmount, 0),
    profitLoss: stocks.reduce((sum, stock) => {
      const currentValue = stock.currentPrice * stock.quantity;
      return sum + (currentValue - stock.investmentAmount);
    }, 0),
  } : null;

  const profitLossRate = currentPortfolioStats 
    ? (currentPortfolioStats.totalCost > 0 ? ((currentPortfolioStats.profitLoss / currentPortfolioStats.totalCost) * 100).toFixed(2) : 0)
    : 0;

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">포트폴리오 최적화</h1>
          <p className="text-muted-foreground mt-2">주식을 추가하고 AI로 포트폴리오를 최적화하세요</p>
        </div>
        {/* 환율 표시 */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
          <p className="text-blue-600 dark:text-blue-400 text-sm mb-1 font-medium">💱 USD/KRW 환율</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            ₩{exchangeRate.rate.toFixed(2)}
            <span className="ml-2 text-xs font-normal text-blue-500">
              {exchangeRate.rate === 1456.0 ? '(기본값)' : '(실시간)'}
            </span>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {exchangeRateError
              ? `오류: ${exchangeRateError} (마지막 성공: ₩${exchangeRate.rate.toFixed(2)}, ${exchangeRate.timestamp ? new Date(exchangeRate.timestamp).toLocaleString('ko-KR') : ''})`
              : (exchangeRate.rate === 1456.0 ? 'API 오류로 기본 환율이 표시됩니다.' : '실시간 환율')}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-md p-6 mb-6 border border-border">
        <h2 className="text-xl font-bold text-card-foreground mb-4">
          종목 추가
        </h2>
        <StockSearchInput 
          onSelectStock={handleSelectStock}
          placeholder="종목명 또는 코드를 입력하세요 (예: 삼성전자, AAPL)"
        />
      </div>

      {selectedStock && (
        <div className="bg-card rounded-xl shadow-md p-6 mb-6 border border-border">
          <h2 className="text-xl font-bold text-card-foreground mb-4">
            <Plus className="inline mr-2" size={20} />
            선택된 종목 정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                종목 코드
              </label>
              <input
                type="text"
                value={selectedStock.symbol}
                readOnly
                className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                종목명
              </label>
              <input
                type="text"
                value={selectedStock.name}
                readOnly
                className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                💰 현재가 (실시간)
              </label>
              <input
                type="number"
                value={currentPrice}
                readOnly
                className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-foreground font-semibold"
                placeholder="조회 중..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                📝 매수가 (입력)
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500"
                placeholder="매수가 입력"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                🔢 수량
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500"
                placeholder="수량 입력"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleAddStock}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {stocks.length > 0 && (
        <div className="bg-card rounded-xl shadow-md p-6 mb-6 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-card-foreground">보유 종목</h2>
            <button
              onClick={updateStockPrices}
              disabled={priceLoading}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={priceLoading ? 'animate-spin' : ''} />
              가격 업데이트
            </button>
          </div>
          
          {lastPriceUpdate && (
            <p className="text-sm text-muted-foreground mb-4">
              마지막 업데이트: {lastPriceUpdate.toLocaleTimeString('ko-KR')}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">종목명</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">코드</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">수량</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">매수가</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">현재가</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">투자금액</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">현재가치</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">손익</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">삭제</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, index) => {
                  const currentValue = stock.currentPrice * stock.quantity;
                  const profitLoss = currentValue - stock.investmentAmount;
                  const profitLossRate = ((profitLoss / stock.investmentAmount) * 100).toFixed(2);
                  
                  return (
                    <tr key={index} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-card-foreground font-medium">{stock.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{stock.symbol}</td>
                      <td className="py-3 px-4 text-right text-card-foreground">{Math.floor(stock.quantity)}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(stock.purchasePrice)}</td>
                      <td className="py-3 px-4 text-right text-card-foreground font-medium">{formatCurrency(stock.currentPrice)}</td>
                      <td className="py-3 px-4 text-right text-card-foreground">{formatCurrency(stock.investmentAmount)}</td>
                      <td className="py-3 px-4 text-right text-card-foreground font-medium">{formatCurrency(currentValue)}</td>
                      <td className={`py-3 px-4 text-right font-medium ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(profitLoss)} ({profitLossRate}%)
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleRemoveStock(stock.symbol)}
                          className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {currentPortfolioStats && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">총 투자금액</p>
                <p className="text-2xl font-bold text-card-foreground">{formatCurrency(currentPortfolioStats.totalCost)}</p>
              </div>
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">현재 평가금액</p>
                <p className="text-2xl font-bold text-card-foreground">{formatCurrency(currentPortfolioStats.totalValue)}</p>
              </div>
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">총 손익</p>
                <p className={`text-2xl font-bold ${currentPortfolioStats.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(currentPortfolioStats.profitLoss)} ({profitLossRate}%)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {stocks.length >= 2 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="mr-3 text-blue-600" size={28} />
            포트폴리오 최적화 설정
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 위험 수준 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📊 위험 수준 (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                value={targetRiskLevel}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value >= 1 && value <= 10) {
                    setTargetRiskLevel(value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-lg"
                placeholder="1-10 사이 입력"
              />
              <p className="text-xs text-gray-500 mt-1">낮을수록 안전, 높을수록 공격적</p>
            </div>

            {/* 목표 수익률 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🎯 목표 수익률 (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={targetReturn}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value >= 0 && value <= 100) {
                    setTargetReturn(value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-lg"
                placeholder="예: 15"
              />
              <p className="text-xs text-gray-500 mt-1">연간 목표 수익률 (0-100%)</p>
            </div>

            {/* 데이터 기간 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 데이터 기간
              </label>
              <select
                value={dataPeriod}
                onChange={(e) => setDataPeriod(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-lg"
              >
                <option value="6개월">6개월</option>
                <option value="1년">1년</option>
                <option value="2년">2년</option>
                <option value="3년">3년</option>
                <option value="5년">5년</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">과거 데이터 분석 기간</p>
            </div>

            {/* 최적화 방법 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔬 최적화 방법
              </label>
              <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-900 font-semibold text-lg">
                QAOA (양자 알고리즘)
              </div>
              <p className="text-xs text-gray-500 mt-1">
                양자 컴퓨팅 알고리즘을 사용하여 최적의 해를 찾습니다.
              </p>
            </div>
          </div>

          {/* 실행 버튼 */}
          <div className="mt-8">
            <button
              onClick={handleOptimize}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-4 rounded-lg transition-all font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={24} />
                  최적화 중...
                </>
              ) : (
                <>
                  <TrendingUp size={24} />
                  🚀 포트폴리오 최적화 실행
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {optimizationResult && (
        <div className="space-y-6">
          {/* AI 자동 요약 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 border-2 border-blue-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-600" size={24} />
                <h2 className="text-xl font-bold text-gray-900">AI 분석 요약</h2>
              </div>
              <button
                onClick={() => {
                  // 플로팅 챗봇 열기
                  if (window.openChatbot) {
                    window.openChatbot(sessionId);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                💬 AI에게 물어보기
              </button>
            </div>
            <div className="bg-white rounded-lg p-4">
              {aiSummary ? (
                <p className="text-gray-800 whitespace-pre-line leading-relaxed">{aiSummary}</p>
              ) : (
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>AI 요약 생성 중...</span>
                </div>
              )}
            </div>
          </div>
          
          {/* 자산 배분 비교 */}
          {optimizationResult.optimalWeights && optimizationResult.optimalWeights.length > 0 && (
            <div className="bg-card rounded-xl shadow-md p-6 border border-border">
              <h2 className="text-xl font-bold text-card-foreground mb-6">자산 배분 비교</h2>
            
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 현재 자산 배분 */}
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-4 text-center">현재 자산 배분</h3>
                  <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stocks.map(stock => ({
                        name: stock.name,
                        value: stock.quantity * stock.currentPrice
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stocks.map((entry, index) => (
                        <Cell key={`cell-current-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => {
                      const total = stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);
                      const percentage = total > 0 ? (value / total) * 100 : 0;
                      return [`${percentage.toFixed(2)}%`, '현재 배분'];
                    }} labelFormatter={name => `${name}`} contentStyle={{
                      backgroundColor: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }} itemStyle={{
                      color: '#1f2937',
                      fontWeight: '600'
                    }} labelStyle={{
                      color: '#4b5563',
                      fontWeight: '700',
                      marginBottom: '4px'
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {stocks.map((stock, index) => {
                    const totalCurrentValue = stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);
                    const stockValue = stock.quantity * stock.currentPrice;
                    const percentage = (stockValue / totalCurrentValue) * 100;
                    
                    return (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-card-foreground">{stock.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-card-foreground">{percentage.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(stockValue)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 추천 자산 배분 */}
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-4 text-center">✨ 추천 자산 배분</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={optimizationResult.optimalWeights}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {optimizationResult.optimalWeights.map((entry, index) => (
                        <Cell
                          key={`cell-optimal-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke="none"
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => {
                        const percentage = (value * 100).toFixed(2);
                        return [`${percentage}%`, '권장 배분'];
                      }}
                      labelFormatter={(name) => `${name}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      itemStyle={{
                        color: '#1f2937',
                        fontWeight: '600'
                      }}
                      labelStyle={{
                        color: '#4b5563',
                        fontWeight: '700',
                        marginBottom: '4px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {optimizationResult.optimalWeights.map((stock, index) => {
                    const shareAlloc = optimizationResult.shareAllocations?.[stock.symbol];
                    const totalCurrentValue = stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);
                    const recommendedInvestment = totalCurrentValue * stock.value;
                    return (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-card-foreground">{stock.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-card-foreground">{(stock.value * 100).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(recommendedInvestment)}
                          </p>
                          {shareAlloc !== undefined && shareAlloc > 0 && (
                            <p className="text-xs text-blue-600 font-semibold mt-1">
                              추천 수량: {shareAlloc}주
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl shadow-md p-6 border border-border">
            <h2 className="text-xl font-bold text-card-foreground mb-4">기대 성과</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">기대 수익률</p>
                <p className="text-2xl font-bold text-green-600">
                  {optimizationResult.expectedReturn?.toFixed(2) || '0.00'}%
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">예상 변동성</p>
                <p className="text-2xl font-bold text-card-foreground">
                  {optimizationResult.expectedRisk?.toFixed(2) || '0.00'}%
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">샤프 비율</p>
                <p className="text-2xl font-bold text-blue-600">
                  {optimizationResult.sharpeRatio?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              포트폴리오 저장
            </button>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md border border-border">
            <h3 className="text-xl font-bold text-card-foreground mb-4">포트폴리오 저장</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="포트폴리오 이름 입력"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName('');
                }}
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSavePortfolio}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortfolioOptimizer;
