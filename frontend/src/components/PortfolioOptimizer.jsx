import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Plus, Trash2, TrendingUp, RefreshCw, Bot, Save } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid } from 'recharts';
import StockSearchInput from './StockSearchInput';

const PortfolioOptimizer = () => {
  const { t } = useTranslation();
  const [stocks, setStocks] = useState([]);
  const stocksRef = useRef(stocks);
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
  const [exchangeRate, setExchangeRate] = useState(() => {
    try {
      const saved = localStorage.getItem('exchangeRate');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.rate === 'number') {
          return parsed;
        }
      }
    } catch (_) {}
    return { rate: 1456, timestamp: 0, cached: false, source: 'default' };
  });
  const [exchangeRateError, setExchangeRateError] = useState('');
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  // 환율 조회 함수 (수동 새로고침용으로도 사용)
  const fetchExchangeRate = async () => {
    try {
      const response = await axios.get('/api/exchange/usd-krw');
      const d = response.data || {};
      // 성공일 때만 상태와 localStorage 갱신
      if (d.success && d.rate > 0) {
        const next = {
          rate: d.rate,
          timestamp: d.cachedTimestamp || d.timestamp || Date.now(),
          cached: !!d.cached,
          source: d.source || 'yahoo'
        };
        setExchangeRate(next);
        localStorage.setItem('exchangeRate', JSON.stringify(next));
        setExchangeRateError('');
        console.log(`💱 환율 업데이트: ₩${d.rate?.toFixed?.(2)} (${d.cached ? '캐시' : '실시간'}) source=${next.source}`);
      } else {
        // 실패 시: 기존 저장값 유지, 메시지만 표시
        const msg = d.message || '환율 조회 실패, 기본값 사용';
        setExchangeRateError(msg);
        console.warn('⚠️ 환율 조회 실패, 유지:', msg);
      }
    } catch (error) {
      setExchangeRateError('환율 API 오류: ' + (error.message || '알 수 없는 오류'));
      console.error('❌ 환율 조회 오류:', error.message);
      // 에러 발생 시 기본값 유지 (초기값 1456)
    }
  };

  // 환율 자동 갱신 (15분마다 = 백엔드 캐시 주기와 동일)
  useEffect(() => {
    fetchExchangeRate();
    const interval = setInterval(fetchExchangeRate, 900000); // 15분 = 900000ms
    return () => clearInterval(interval);
  }, []);

  // 페이지 로드 시 종목 불러오기
  useEffect(() => {
    const loadStocks = async () => {
      // 1. localStorage에서 임시 데이터 확인 (Dashboard에서 전달된 데이터)
      const optimizationStocks = localStorage.getItem('optimizationStocks');
      if (optimizationStocks) {
        try {
          const userStocks = JSON.parse(optimizationStocks);
          console.log('📦 [Optimizer] localStorage 데이터 로드:', userStocks);
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
                investmentAmount: avgPurchasePrice * totalQuantity
              };
            } else {
              mergedStocks[ticker] = {
                symbol: ticker,
                name: stock.name,
                market: ticker.includes('.KS') || ticker.includes('.KQ') ? 'DOMESTIC' : 'FOREIGN',
                quantity: stock.quantity,
                currentPrice: stock.currentPrice,
                purchasePrice: stock.purchasePrice,
                investmentAmount: stock.purchasePrice * stock.quantity,
                riskLevel: 5
              };
            }
          });
          
          const convertedStocks = Object.values(mergedStocks);
          console.log('✅ [Optimizer] 병합 완료:', convertedStocks);
          setStocks(convertedStocks);
          localStorage.removeItem('optimizationStocks');
          return; // localStorage에서 로드했으면 서버 조회 스킵
        } catch (error) {
          console.error('❌ [Optimizer] Stock load error:', error);
        }
      }
    };

    loadStocks();
  }, []);

  // stocksRef를 최신 상태로 유지
  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  useEffect(() => {
    const total = stocks.reduce((sum, stock) => sum + stock.investmentAmount, 0);
    setTotalInvestment(total);
  }, [stocks]);

  // 주가 일괄 업데이트 함수 (보유 종목 가격 새로고침) - 개별 업데이트로 UI 깜빡임 방지
  const updateStockPrices = useCallback(async () => {
    const currentStocks = stocksRef.current;
    if (!currentStocks || currentStocks.length === 0) return;

    setPriceLoading(true);
    try {
      for (let i = 0; i < currentStocks.length; i++) {
        const stock = currentStocks[i];
        try {
          const response = await axios.get(`/api/portfolio/stock-price/${stock.symbol}`);
          const newPrice = response.data.currentPrice ?? response.data.price;
          const safePrice = typeof newPrice === 'number' && !Number.isNaN(newPrice) ? newPrice : stock.currentPrice;
          
          // 가격이 실제로 변경된 경우에만 개별 업데이트
          if (Math.abs(safePrice - stock.currentPrice) > 0.01) {
            console.log(`✅ ${stock.name}: ₩${Math.round(stock.currentPrice).toLocaleString()} -> ₩${Math.round(safePrice).toLocaleString()}`);
            
            setStocks(prevStocks => {
              return prevStocks.map(s => 
                s.symbol === stock.symbol 
                  ? { 
                      ...s, 
                      currentPrice: safePrice,
                      investmentAmount: s.purchasePrice * s.quantity
                    }
                  : s
              );
            });
          }
        } catch (err) {
          console.warn(`가격 업데이트 실패: ${stock.symbol}`, err?.message || err);
        }
        
        // 다음 종목 조회 전 300ms 대기 (API rate limit 방지)
        if (i < currentStocks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      setLastPriceUpdate(new Date());
    } catch (error) {
      console.error('주가 업데이트 중 오류:', error);
    } finally {
      setPriceLoading(false);
    }
  }, []); // 빈 의존성 배열로 변경하여 함수 재생성 방지

  // 초기 및 주기적 가격 업데이트 (30초 간격)
  useEffect(() => {
    if (!stocks || stocks.length === 0) return;
    
    console.log('📊 [Optimizer] 주가 업데이트 타이머 설정, 종목 수:', stocks.length);
    
    // 초기 가격 업데이트
    updateStockPrices();
    
    // 주기적 업데이트 (30초 간격)
    const interval = setInterval(() => {
      console.log('🔄 [Optimizer] 30초 자동 업데이트');
      updateStockPrices();
    }, 30000);
    
    return () => {
      console.log('🛑 [Optimizer] 주가 업데이트 인터벌 종료');
      clearInterval(interval);
    };
  }, [stocks.length, updateStockPrices]);

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

      // Diversification constraints: enforce 5%–40% per stock by default
      const diversification = stocks.reduce((acc, s) => {
        acc[s.symbol] = { min: 0.05, max: 0.40 };
        return acc;
      }, {});

      const response = await axios.post('/api/portfolio/optimize', {
        sessionId: sessionId, // AI 요약을 위한 세션 ID
        stocks: stockData,
        targetReturn: targetReturn,
        riskLevel: targetRiskLevel,
        dataPeriod: dataPeriod,
        optimizationMethod: 'HYBRID', // Fast 2-bit QAOA + MPT path
        useRealData: true, // 항상 실시간 데이터 사용
        constraints: diversification
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
        const currentPrice = originalStock?.currentPrice || 0;
        const purchasePrice = originalStock?.purchasePrice || currentPrice; // 실제 매수가 사용
        const newQuantity = currentPrice > 0 ? (newInvestment / currentPrice) : 0;
        const isDomestic = optimizedStock.symbol.endsWith('.KS') || optimizedStock.symbol.endsWith('.KQ');

        console.log(`📊 [SavePortfolio] ${optimizedStock.symbol}: 매수가=${purchasePrice}, 현재가=${currentPrice}, 수량=${newQuantity}`);

        return {
          ticker: optimizedStock.symbol,
          displayName: optimizedStock.name,
          currency: isDomestic ? 'KRW' : 'USD',
          quantity: Number(newQuantity.toFixed(6)),
          purchasePrice: Number(purchasePrice.toFixed(2)), // 실제 매수가 저장
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
      // 날짜 객체로 저장하여 렌더링 시 일관되게 포맷팅
      setLastPriceUpdate(new Date());
    }
  };

  // 종목 추가 핸들러
  const handleAddStock = async () => {
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

    // 1. 로컬 상태 업데이트
    const updatedStocks = [...stocks, newStock];
    setStocks(updatedStocks);
    
    // 2. 서버에 저장 시도
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post('/api/user/stocks', {
          ticker: newStock.symbol,
          name: newStock.name,
          quantity: newStock.quantity,
          purchasePrice: newStock.purchasePrice,
          currentPrice: newStock.currentPrice
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ 종목이 서버에 저장되었습니다:', newStock.symbol);
      }
    } catch (error) {
      console.warn('⚠️ 서버 저장 실패 (로컬에만 저장됨):', error.message);
    }
    
    // 3. 입력 필드 초기화
    setSelectedStock(null);
    setQuantity('');
    setPurchasePrice('');
    setCurrentPrice('');
    alert('✅ 종목이 추가되었습니다.');
  };

  // 종목 삭제 핸들러
  const handleRemoveStock = async (symbol) => {
    if (window.confirm('해당 종목을 삭제하시겠습니까?')) {
      // 1. 로컬 상태 업데이트
      setStocks(stocks.filter(stock => stock.symbol !== symbol));
      
      // 2. 서버에서도 삭제 시도
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await axios.delete(`/api/user/stocks/${encodeURIComponent(symbol)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          console.log('✅ 종목이 서버에서 삭제되었습니다:', symbol);
        }
      } catch (error) {
        console.warn('⚠️ 서버 삭제 실패 (로컬에서만 삭제됨):', error.message);
      }
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
      {/* 면책조항 경고 */}
      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-600 rounded">
        <p className="text-xs text-yellow-900 dark:text-yellow-100">
          ⚠️ {t('investmentWarningShort')}
        </p>
      </div>

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('portfolioOptimizeTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('portfolioOptimizeSubtitle')}</p>
        </div>
        {/* 환율 표시 */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">💱 {t('exchangeRate')}</p>
            <button
              onClick={fetchExchangeRate}
              className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              title={t('refresh')}
            >
              🔄 {t('refresh')}
            </button>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            ₩{exchangeRate.rate.toFixed(2)}
            <span className="ml-2 text-xs font-normal text-blue-500">
              {exchangeRateError
                ? `(${t('cached')})`
                : exchangeRate.cached
                  ? `(${t('cached')})`
                  : `(${t('realtime')})`}
            </span>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {exchangeRateError
              ? `${t('source')}: ${exchangeRate.source || 'yahoo'}`
              : `${t('source')}: ${exchangeRate.source || 'yahoo'} • ${t('updated')}: ${exchangeRate.timestamp ? new Date(exchangeRate.timestamp).toLocaleString(t('language') === 'en' ? 'en-US' : 'ko-KR') : ''}`}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-md p-6 mb-6 border border-border">
        <h2 className="text-xl font-bold text-card-foreground mb-4">
          {t('addStockTitle')}
        </h2>
        <StockSearchInput 
          onSelectStock={handleSelectStock}
          placeholder={t('stockSearch')}
        />
      </div>

      {selectedStock && (
        <div className="bg-card rounded-xl shadow-md p-6 mb-6 border border-border">
          <h2 className="text-xl font-bold text-card-foreground mb-4">
            <Plus className="inline mr-2" size={20} />
            {t('addStock')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                {t('stockCode')}
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
                {t('stockName')}
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
                💰 {t('currentPrice')}
              </label>
              <input
                type="number"
                value={currentPrice}
                readOnly
                className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-foreground font-semibold"
                placeholder={t('currentPrice')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                📝 {t('purchasePrice')}
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500"
                placeholder={t('purchasePrice')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                🔢 {t('quantity')}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-blue-500"
                placeholder={t('quantity')}
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleAddStock}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
            >
              {t('add')}
            </button>
          </div>
        </div>
      )}

      {stocks.length > 0 && (
        <div className="bg-card rounded-xl shadow-md p-6 mb-6 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-card-foreground">{t('holdings')}</h2>
            <button
              onClick={updateStockPrices}
              disabled={priceLoading}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={priceLoading ? 'animate-spin' : ''} />
              {t('updatePrice')}
            </button>
          </div>
          
          {lastPriceUpdate && (
            <p className="text-sm text-muted-foreground mb-4">
              {t('lastUpdate')}: {lastPriceUpdate.toLocaleTimeString(t('language') === 'en' ? 'en-US' : 'ko-KR')}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">{t('stockName')}</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">{t('stockCode')}</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('quantity')}</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('purchasePrice')}</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('currentPrice')}</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('totalInvestment')}</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('currentValue')}</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('totalProfitLoss')}</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">{t('delete')}</th>
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
                <p className="text-sm text-muted-foreground mb-1">{t('totalInvestment')}</p>
                <p className="text-2xl font-bold text-card-foreground">{formatCurrency(currentPortfolioStats.totalCost)}</p>
              </div>
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">{t('currentValue')}</p>
                <p className="text-2xl font-bold text-card-foreground">{formatCurrency(currentPortfolioStats.totalValue)}</p>
              </div>
              <div className="bg-muted rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">{t('totalProfitLoss')}</p>
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
            {t('optimizationSettings')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 위험 수준 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📊 {t('riskLevel')} (1-10)
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
                placeholder="1-10"
              />
              <p className="text-xs text-gray-500 mt-1">{t('riskLevel')}</p>
            </div>

            {/* 목표 수익률 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🎯 {t('targetReturn')} (%)
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
                placeholder="15"
              />
              <p className="text-xs text-gray-500 mt-1">{t('targetReturn')}</p>
            </div>

            {/* 데이터 기간 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 {t('dataPeriod')}
              </label>
              <select
                value={dataPeriod}
                onChange={(e) => setDataPeriod(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-lg"
              >
                <option value="6개월">6개월</option>
                <option value="1년">1년</option>
                <option value="2년">2년</option>
                <option value="3년">3{t('language') === 'en' ? ' years' : '년'}</option>
                <option value="5년">5{t('language') === 'en' ? ' years' : '년'}</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">{t('dataPeriod')}</p>
            </div>

            {/* 최적화 방법 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔬 {t('optimizationMethod')}
              </label>
              <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-900 font-semibold text-lg">
                {t('qaoa')}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('qaoaDesc')}
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
                  {t('optimizing')}
                </>
              ) : (
                <>
                  <TrendingUp size={24} />
                  🚀 {t('runOptimization')}
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
                <h2 className="text-xl font-bold text-gray-900">{t('aiSummary')}</h2>
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
                💬 {t('askAI')}
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
              <h2 className="text-xl font-bold text-card-foreground mb-6">{t('assetAllocation')}</h2>
            
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 현재 자산 배분 */}
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-4 text-center">{t('currentAllocation')}</h3>
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
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded-lg border border-border min-h-20">
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
                <h3 className="text-lg font-semibold text-card-foreground mb-4 text-center">✨ {t('recommendedAllocation')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={(optimizationResult.optimalWeights || []).map(w => ({
                        ...w,
                        value: ((optimizationResult.shareAllocations?.[w.symbol] ?? 0) > 0) ? w.value : 0
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => {
                        const symbol = props?.payload?.payload?.symbol;
                        const shares = optimizationResult.shareAllocations?.[symbol] ?? 0;
                        const percentage = (props.value * 100).toFixed(1);
                        return shares > 0 ? `${props.name} ${shares}주` : `${props.name} ${percentage}%`;
                      }}
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
                      formatter={(value, name, item) => {
                        const symbol = item?.payload?.symbol;
                        const shares = optimizationResult.shareAllocations?.[symbol] ?? 0;
                        return [`${shares}주`, '권장 수량'];
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
                  {(() => {
                    const currentMap = new Map(stocks.map(s => [s.symbol, { name: s.name, shares: s.quantity, value: s.quantity * s.currentPrice }]));
                    const optimalMap = new Map((optimizationResult.optimalWeights || []).map(w => [w.symbol, { name: w.name, weight: w.value }]));
                    const shareMap = optimizationResult.shareAllocations || {};
                    const unionSymbols = Array.from(new Set([...currentMap.keys(), ...optimalMap.keys()]));
                    const totalCurrentValue = stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);

                    return unionSymbols.map((symbol, idx) => {
                      const cur = currentMap.get(symbol) || { name: optimalMap.get(symbol)?.name || symbol, shares: 0, value: 0 };
                      const opt = optimalMap.get(symbol) || { name: cur.name, weight: 0 };
                      const recShares = shareMap[symbol] ?? 0;
                      const deltaShares = recShares - (cur.shares || 0);
                      const absShares = Math.abs(deltaShares);
                      const displayName = cur.name || opt.name || symbol;
                      const recommendedInvestment = totalCurrentValue * (opt.weight || 0);

                      return (
                        <div key={symbol} className="flex justify-between items-center p-2 bg-muted rounded-lg border border-border min-h-20">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="text-sm font-medium text-card-foreground">{displayName}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-card-foreground">
                              {recShares}주
                              {deltaShares !== 0 && (
                                <span className={`ml-2 ${deltaShares > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ({deltaShares > 0 ? '+' : '-'}{absShares}주)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(recommendedInvestment)}</p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              {t('savePortfolio')}
            </button>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md border border-border">
            <h3 className="text-xl font-bold text-card-foreground mb-4">{t('savePortfolioTitle')}</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t('portfolioName')}
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
                {t('cancel')}
              </button>
              <button
                onClick={handleSavePortfolio}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortfolioOptimizer;
