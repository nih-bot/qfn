import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Zap, RefreshCw, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { koFromEn } from '../utils/stockAliases';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // 종목 합치기 함수 (평균 매수가 계산)
  const mergeStocks = (stocks) => {
    const merged = {};
    
    stocks.forEach(stock => {
      const ticker = stock.ticker;
      
      if (merged[ticker]) {
        // 이미 존재하는 종목 - 수량과 평균 매수가 계산
        const existing = merged[ticker];
        const totalQuantity = existing.quantity + stock.quantity;
        const totalInvestment = (existing.purchasePrice * existing.quantity) + (stock.purchasePrice * stock.quantity);
        const avgPurchasePrice = totalInvestment / totalQuantity;
        
        // 매입 이력 추가 (기존 이력 + 새 매입)
        const purchaseHistory = [
          ...(existing.purchaseHistory || [{ price: existing.purchasePrice, quantity: existing.quantity, date: existing.addedDate }]),
          { price: stock.purchasePrice, quantity: stock.quantity, date: stock.addedDate }
        ];
        
        merged[ticker] = {
          ...existing,
          quantity: totalQuantity,
          purchasePrice: avgPurchasePrice,
          purchaseHistory: purchaseHistory,
          isAveraged: true, // 평균 매수가로 합쳐진 종목 표시
          // currentPrice는 동일하므로 기존 값 유지
        };
      } else {
        // 새로운 종목 추가 (기존 속성 유지)
        merged[ticker] = { 
          ...stock,
          purchaseHistory: stock.purchaseHistory || [{ price: stock.purchasePrice, quantity: stock.quantity, date: stock.addedDate }],
          isAveraged: stock.isAveraged || false
        };
      }
    });
    
    return Object.values(merged);
  };

  // 종목 관리
  const [userStocks, setUserStocks] = useState(() => {
    const saved = localStorage.getItem('userStocks');
    if (saved) {
      const stocks = JSON.parse(saved);
      return mergeStocks(stocks); // 초기 로드 시에도 합치기
    }
    return [];
  });
  
  // 최적화 결과 관리
  // 최적화 결과 관리 (localStorage는 더 이상 사용하지 않음)
  const [savedOptimizations, setSavedOptimizations] = useState([]);
  
  // 서버 포트폴리오 관리
  const [savedPortfolios, setSavedPortfolios] = useState([]);
  // 저장된 포트폴리오 자산의 실시간 가격(KRW) 캐시
  const [savedPriceMap, setSavedPriceMap] = useState({});

  // 환율 관리
  const [exchangeRate, setExchangeRate] = useState(() => {
    const saved = localStorage.getItem('exchangeRate');
    return saved ? JSON.parse(saved) : { rate: 1456, timestamp: 0 };
  });
  
  // 종목 추가 모달
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStock, setNewStock] = useState({
    ticker: '',
    name: '',
    quantity: '',
    purchasePrice: ''
  });
  
  // 매입 이력 모달
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStockHistory, setSelectedStockHistory] = useState(null);
  
  // 포트폴리오 상세 모달
  const [showPortfolioDetailModal, setShowPortfolioDetailModal] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  
  // 종목 검색
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // 로그인 체크
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  // 서버에서 저장된 포트폴리오 불러오기 (재사용 가능한 함수)
  const fetchPortfolios = useCallback(async () => {
    console.log('🚀 [fetchPortfolios] 시작 - isAuthenticated:', isAuthenticated);
    
    try {
      if (!isAuthenticated) {
        console.log('⚠️ [fetchPortfolios] 인증되지 않음, 종료');
        return;
      }
      
  console.log('📡 [fetchPortfolios] API 호출: GET /api/portfolios');
  const response = await axios.get('/api/portfolios');
  console.log('📥 [fetchPortfolios] 전체 응답:', response);
  console.log('� [fetchPortfolios] 응답 데이터:', response.data);
  console.log('🔑 [fetchPortfolios] 응답 상태:', response.status);
  const data = response.data;
      
      if (!Array.isArray(data)) {
        console.warn('⚠️ [fetchPortfolios] 포트폴리오 응답이 배열이 아님. 타입:', typeof data, '값:', data);
        setSavedPortfolios([]);
        return;
      }
      
  console.log(`✅ [fetchPortfolios] 저장된 포트폴리오: ${data.length}개`);
  console.log('📋 [fetchPortfolios] 포트폴리오 목록:', data.map(p => ({ id: p.id, name: p.name, assets: p.assets?.length })));
      
      setSavedPortfolios(data);
    } catch (error) {
      console.error('❌ [fetchPortfolios] 조회 실패:', error);
      console.error('❌ [fetchPortfolios] 에러 상세:', error.response?.data);
      console.error('❌ [fetchPortfolios] 에러 상태:', error.response?.status);
      setSavedPortfolios([]);
    }
  }, [isAuthenticated]);

  // 서버에서 보유 종목 불러오기
  const fetchUserStocks = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      console.log('📡 [Dashboard] 보유 종목 조회 시작');
      const response = await axios.get('/api/user-stocks');
      console.log('✅ [Dashboard] 보유 종목 조회 성공:', response.data);
      
      if (Array.isArray(response.data)) {
        const stocks = response.data.map(stock => ({
          id: stock.id,
          ticker: stock.ticker,
          name: stock.name,
          quantity: Number(stock.quantity),
          purchasePrice: Number(stock.purchasePrice),
          currentPrice: Number(stock.currentPrice || stock.purchasePrice),
          currency: stock.currency,
          isForeign: stock.isForeign,
          addedDate: stock.addedDate
        }));
        
        const mergedStocks = mergeStocks(stocks);
        setUserStocks(mergedStocks);
        localStorage.setItem('userStocks', JSON.stringify(mergedStocks));
        console.log(`💼 [Dashboard] 보유 종목 ${mergedStocks.length}개 로드 완료`);
        
        // 종목 로딩 후 즉시 실시간 가격 업데이트 트리거
        setTimeout(() => {
          updatePricesAsync(mergedStocks);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ [Dashboard] 보유 종목 조회 실패:', error);
      // 에러 시 localStorage에서 복구
      const saved = localStorage.getItem('userStocks');
      if (saved) {
        setUserStocks(JSON.parse(saved));
      }
    }
  }, [isAuthenticated]);

  // 환율 조회 및 초기 데이터 로드
  useEffect(() => {
    if (!isAuthenticated) return;

    // 초기 포트폴리오 로드
    fetchPortfolios();
    
    // 초기 보유 종목 로드
    console.log('🎯 [Dashboard] 초기 보유종목 로드 시작');
    fetchUserStocks();

    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/exchange/usd-krw');
        const data = await response.json();
        
        if (data.success) {
          const rateData = {
            rate: data.rate,
            timestamp: Date.now()
          };
          setExchangeRate(rateData);
          localStorage.setItem('exchangeRate', JSON.stringify(rateData));
          console.log(`💱 USD/KRW 환율: ${data.rate.toFixed(2)}원`);
        }
      } catch (error) {
        console.error('환율 조회 실패:', error);
      }
    };

    // 초기 조회
    fetchExchangeRate();

    // 24시간마다 환율 갱신 (API 제한 방지)
    const interval = setInterval(fetchExchangeRate, 86400000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchPortfolios, fetchUserStocks]);

  // 사용자 종목 목록 정기적 새로고침 (30초마다)
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('🔄 [Dashboard] 종목 목록 정기 새로고침 설정');
    
    // 30초마다 서버에서 종목 목록 새로고침
    const stockRefreshInterval = setInterval(() => {
      console.log('🔄 [Dashboard] 30초 종목 목록 새로고침');
      fetchUserStocks();
    }, 30000);

    return () => {
      console.log('🛑 [Dashboard] 종목 목록 새로고침 해제');
      clearInterval(stockRefreshInterval);
    };
  }, [isAuthenticated, fetchUserStocks]);

  // 저장된 포트폴리오 자산 실시간 가격 조회(클라이언트 측 반영)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!Array.isArray(savedPortfolios) || savedPortfolios.length === 0) return;

    // 포트폴리오 내 모든 티커 수집(중복 제거)
    const uniqueTickers = Array.from(new Set(savedPortfolios.flatMap(p => (p.assets || []).map(a => a.ticker))));
    if (uniqueTickers.length === 0) return;

    let cancelled = false;

    const fetchSequential = async () => {
      for (let i = 0; i < uniqueTickers.length; i++) {
        const ticker = uniqueTickers[i];
        try {
          const resp = await fetch(`http://localhost:8080/api/stocks/price/${ticker}`);
          const data = await resp.json();
          if (data && data.success) {
            const base = Number(data.currentPrice) || 0;
            const priceKRW = isForeignStock(ticker) ? base * exchangeRate.rate : base;
            if (!cancelled) {
              setSavedPriceMap(prev => ({ ...prev, [ticker]: priceKRW }));
            }
          }
        } catch (e) {
          // 무시하고 다음으로 진행 (일시적인 실패 허용)
        }
        // Rate limit 보호 딜레이
        if (i < uniqueTickers.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    };

    fetchSequential();
    return () => { cancelled = true; };
    // 환율 변경 시에도 재계산 필요
  }, [isAuthenticated, savedPortfolios, exchangeRate.rate]);

  // 저장 이벤트 수신하여 자동 갱신
  useEffect(() => {
    const handler = (event) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📥 [Dashboard] portfolio:saved 이벤트 수신!');
      console.log('📦 이벤트 detail:', event.detail);
      console.log('🔄 포트폴리오 목록 재조회 시작...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 약간의 지연을 두고 재조회 (서버 저장 완료 대기)
      setTimeout(() => {
        console.log('🔍 [Dashboard] fetchPortfolios() 호출 중...');
        fetchPortfolios();
      }, 500);
    };
    
    window.addEventListener('portfolio:saved', handler);
    console.log('✅ [Dashboard] portfolio:saved 이벤트 리스너 등록 완료');
    
    return () => {
      window.removeEventListener('portfolio:saved', handler);
      console.log('🔴 [Dashboard] portfolio:saved 이벤트 리스너 해제');
    };
  }, [fetchPortfolios]);

  // 종목 검색
  const searchStocks = async (query) => {
    if (query.length < 1) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`http://localhost:8080/api/stocks/search?query=${encodeURIComponent(query)}`);
      let data = await response.json();

      // If no result or query seems English, try Korean alias fallback
      const alt = koFromEn(query);
      if ((data?.length ?? 0) === 0 && alt && alt !== query) {
        const altResp = await fetch(`http://localhost:8080/api/stocks/search?query=${encodeURIComponent(alt)}`);
        const altData = await altResp.json();
        if (Array.isArray(altData)) {
          data = altData;
        }
      }

      setSearchResults(data || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('검색 오류:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) searchStocks(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 종목 선택
  const handleSelectStock = async (stock) => {
    let displayName = stock.name;
    const koreanNameMatch = stock.name.match(/^([^(]+)/);
    if (koreanNameMatch) {
      displayName = koreanNameMatch[1].trim();
    }
    
    try {
      const response = await fetch(`http://localhost:8080/api/stocks/price/${stock.ticker}`);
      const priceData = await response.json();
      
      if (priceData.success) {
        // 외국 주식이면 환율 적용하여 원화로 변환
        const priceKRW = isForeignStock(stock.ticker) 
          ? priceData.currentPrice * exchangeRate.rate 
          : priceData.currentPrice;
        
        setNewStock({
          ...newStock,
          ticker: stock.ticker,
          name: displayName,
          purchasePrice: Math.round(priceKRW).toString()
        });
      } else {
        setNewStock({
          ...newStock,
          ticker: stock.ticker,
          name: displayName
        });
      }
    } catch (error) {
      console.error('현재가 조회 실패:', error);
      setNewStock({
        ...newStock,
        ticker: stock.ticker,
        name: displayName
      });
    }
    
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // 외국 주식 여부 확인
  const isForeignStock = (ticker) => {
    // 한국 주식은 .KS 또는 .KQ로 끝남
    return !ticker.endsWith('.KS') && !ticker.endsWith('.KQ');
  };

  // 가격을 원화로 변환
  const convertToKRW = (price, ticker) => {
    if (isForeignStock(ticker)) {
      return price * exchangeRate.rate;
    }
    return price;
  };

  // 종목 추가
  const handleAddStock = async () => {
    if (!newStock.ticker || !newStock.name || !newStock.quantity || !newStock.purchasePrice) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    // 같은 종목이 이미 있는지 확인
    const existingStock = userStocks.find(stock => stock.ticker === newStock.ticker);
    
    if (existingStock) {
      const newQuantity = parseFloat(newStock.quantity);
      const newPrice = parseFloat(newStock.purchasePrice);
      const totalQuantity = existingStock.quantity + newQuantity;
      const avgPrice = ((existingStock.purchasePrice * existingStock.quantity) + (newPrice * newQuantity)) / totalQuantity;
      
      const confirm = window.confirm(
        `📊 동일한 종목(${newStock.name}) 추가\n\n` +
        `[기존 보유]\n` +
        `매수가: ₩${Math.round(existingStock.purchasePrice).toLocaleString()}\n` +
        `수량: ${existingStock.quantity}주\n\n` +
        `[새로 추가]\n` +
        `매수가: ₩${Math.round(newPrice).toLocaleString()}\n` +
        `수량: ${newQuantity}주\n\n` +
        `[합산 결과]\n` +
        `평균 매수가: ₩${Math.round(avgPrice).toLocaleString()}\n` +
        `총 수량: ${totalQuantity}주\n\n` +
        `추가하시겠습니까?`
      );
      
      if (!confirm) {
        setShowAddStockModal(false);
        setNewStock({ ticker: '', name: '', quantity: '', purchasePrice: '' });
        setSearchQuery('');
        setSearchResults([]);
        return;
      }
    }

    // 현재가 조회
    let currentPrice = parseFloat(newStock.purchasePrice); // 기본값은 매수가
    try {
      const response = await fetch(`http://localhost:8080/api/stocks/price/${newStock.ticker}`);
      const priceData = await response.json();
      
      if (priceData.success) {
        // 외국 주식이면 환율 적용하여 원화로 변환
        currentPrice = isForeignStock(newStock.ticker) 
          ? priceData.currentPrice * exchangeRate.rate 
          : priceData.currentPrice;
        console.log(`${newStock.name} 현재가: ₩${Math.round(currentPrice).toLocaleString()}`);
      } else {
        console.warn(`${newStock.name} 현재가 조회 실패, 매수가 사용`);
      }
    } catch (error) {
      console.error('현재가 조회 실패:', error);
    }

    // 서버에 저장할 데이터 준비
    const stockData = {
      ticker: newStock.ticker,
      name: newStock.name,
      quantity: parseFloat(newStock.quantity),
      purchasePrice: parseFloat(newStock.purchasePrice),
      currentPrice: currentPrice,
      currency: isForeignStock(newStock.ticker) ? 'USD' : 'KRW',
      isForeign: isForeignStock(newStock.ticker)
    };

    try {
      // 서버에 저장
      console.log('💾 [Dashboard] 종목 서버 저장 시작:', stockData);
      const response = await axios.post('/api/user-stocks', stockData);
      console.log('✅ [Dashboard] 종목 서버 저장 성공:', response.data);
      
      // 서버에서 저장된 데이터로 상태 업데이트
      const savedStock = {
        id: response.data.id,
        ticker: response.data.ticker,
        name: response.data.name,
        quantity: Number(response.data.quantity),
        purchasePrice: Number(response.data.purchasePrice),
        currentPrice: Number(response.data.currentPrice),
        currency: response.data.currency,
        isForeign: response.data.isForeign,
        addedDate: response.data.addedDate
      };

      // 로컬 상태 업데이트 (localStorage는 백업용으로만 사용)
      const mergedStocks = mergeStocks([...userStocks, savedStock]);
      setUserStocks(mergedStocks);
      localStorage.setItem('userStocks', JSON.stringify(mergedStocks));
      
      // 새로운 종목 추가 후 즉시 해당 종목의 가격 업데이트
      setTimeout(() => {
        updatePricesAsync([savedStock]);
      }, 500);
      
      alert('종목이 추가되었습니다.');
    } catch (error) {
      console.error('❌ [Dashboard] 종목 저장 실패:', error);
      alert('종목 저장에 실패했습니다: ' + (error.response?.data || error.message));
      return;
    }
    
    setShowAddStockModal(false);
    setNewStock({ ticker: '', name: '', quantity: '', purchasePrice: '' });
    setSearchQuery('');
    setSearchResults([]);
  };

  // 매입 이력 보기
  const handleShowHistory = (stock) => {
    setSelectedStockHistory(stock);
    setShowHistoryModal(true);
  };

  // 종목 삭제
  const handleRemoveStock = async (ticker) => {
    const stockToDelete = userStocks.find(stock => stock.ticker === ticker);
    
    if (!stockToDelete) {
      console.warn('삭제할 종목을 찾을 수 없습니다:', ticker);
      return;
    }

    if (!window.confirm(`${stockToDelete.name} (${ticker})를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // 서버에서 삭제
      if (stockToDelete.id) {
        console.log('🗑️ [Dashboard] 종목 서버 삭제 시작:', ticker, 'id:', stockToDelete.id);
        await axios.delete(`/api/user-stocks/${stockToDelete.id}`);
        console.log('✅ [Dashboard] 종목 서버 삭제 성공');
      }
      
      // 로컬 상태 업데이트
      const updatedStocks = userStocks.filter(stock => stock.ticker !== ticker);
      setUserStocks(updatedStocks);
      localStorage.setItem('userStocks', JSON.stringify(updatedStocks));
      
    } catch (error) {
      console.error('❌ [Dashboard] 종목 삭제 실패:', error);
      alert('종목 삭제에 실패했습니다: ' + (error.response?.data || error.message));
    }
  };

  // 현재가 업데이트 함수
  const updateStockPricesRef = useRef(null);
  
  updateStockPricesRef.current = async () => {
    // 현재 상태를 직접 참조하지 말고, 함수형 업데이트 사용
    setUserStocks(currentStocks => {
      if (currentStocks.length === 0) {
        return currentStocks;
      }
      
      console.log('=== 주가 업데이트 시작 ===');
      console.log('업데이트할 종목 수:', currentStocks.length);
      
      // 비동기 업데이트는 별도 함수로 처리
      updatePricesAsync(currentStocks);
      
      return currentStocks; // 상태 변경 없이 반환 (비동기 처리)
    });
  };
  
  // 실제 주가 업데이트 로직 (한 번에 모든 가격 업데이트로 깜빡임 방지)
  const updatePricesAsync = async (currentStocks) => {
    const updatedPrices = {};
    let hasChanges = false;
    
    try {
      console.log('📊 [Dashboard] 가격 업데이트 시작:', currentStocks.length, '종목');
      
      for (let i = 0; i < currentStocks.length; i++) {
        const stock = currentStocks[i];
        
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`http://localhost:8080/api/portfolio/stock-price/${stock.ticker}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const priceData = await response.json();
          
          console.log(`📈 [${stock.ticker}] API 응답:`, priceData);
          
          let newPrice = priceData.currentPrice ?? priceData.price;
          
          // 외국 주식이면 환율 적용하여 원화로 변환
          if (stock.isForeign && exchangeRate?.rate) {
            newPrice = newPrice * exchangeRate.rate;
            console.log(`💱 [${stock.ticker}] 환율 적용: ${priceData.currentPrice} USD → ₩${Math.round(newPrice).toLocaleString()}`);
          }
          
          // 가격이 실제로 변경된 경우에만 기록
          if (Math.abs(newPrice - stock.currentPrice) > 0.01) {
            console.log(`📊 수익/손실 계산 디버그 - ${stock.name}:`);
            console.log(`  - 현재가: ₩${Math.round(stock.currentPrice).toLocaleString()}`);
            console.log(`  - 새 가격: ₩${Math.round(newPrice).toLocaleString()}`);
            console.log(`  - 매수가: ₩${Math.round(stock.purchasePrice).toLocaleString()}`);
            console.log(`  - 수량: ${stock.quantity}`);
            
            updatedPrices[stock.ticker] = newPrice;
            hasChanges = true;
          }
        } catch (error) {
          console.error(`❌ ${stock.name} 가격 업데이트 실패:`, error.message);
        }
        
        // 다음 종목 조회 전 300ms 대기 (API rate limit 방지)
        if (i < currentStocks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // 변경된 가격이 있을 때만 한 번에 모든 가격 업데이트
      if (hasChanges) {
        console.log('💰 [Dashboard] 가격 업데이트 적용:', Object.keys(updatedPrices));
        
        setUserStocks(prevStocks => {
          const newStocks = prevStocks.map(stock => {
            const newPrice = updatedPrices[stock.ticker];
            if (newPrice !== undefined) {
              const profit = (newPrice - stock.purchasePrice) * stock.quantity;
              console.log(`📊 ${stock.name} 수익/손실: ₩${Math.round(profit).toLocaleString()}`);
              
              return {
                ...stock,
                currentPrice: newPrice
              };
            }
            return stock;
          });
          
          localStorage.setItem('userStocks', JSON.stringify(newStocks));
          return newStocks;
        });
        
        // 즉시 가격 업데이트 후 1초 후에 다시 한 번 업데이트 (안정성)
        setTimeout(() => updatePricesAsync(currentStocks), 1000);
      }
      
      console.log('=== 주가 업데이트 완료 ===');
      
    } catch (error) {
      console.error('❌ 주가 업데이트 중 오류:', error);
    }
  };

  // 주가 자동 업데이트 (로그인 상태일 때만, 한 번만 설정)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    console.log('📊 주가 자동 업데이트 타이머 설정');
    
    // 5분(300초)마다 반복 - 초기 실행은 하지 않음 (중복 방지)
    const interval = setInterval(() => {
      if (updateStockPricesRef.current) {
        console.log('🔄 5분 자동 업데이트');
        updateStockPricesRef.current();
      }
    }, 300000);
    
    return () => {
      console.log('🛑 주가 업데이트 인터벌 종료');
      clearInterval(interval);
    };
  }, [isAuthenticated]); // isAuthenticated만 감지 - 한 번만 설정

  // 최적화 페이지로 이동 (종목 데이터 전달)
  const handleOptimize = () => {
    if (userStocks.length === 0) {
      alert('종목을 먼저 추가해주세요.');
      return;
    }
    
  // localStorage에 종목 데이터 저장 (최적화 페이지에서 읽어갈 수 있도록)
  console.log('🚀 [Dashboard] 최적화 버튼 클릭 - 저장할 종목 수:', userStocks.length);
  console.log('📦 [Dashboard] 저장할 데이터:', userStocks);
  localStorage.setItem('optimizationStocks', JSON.stringify(userStocks));
    
  // 저장 확인
  const saved = localStorage.getItem('optimizationStocks');
  console.log('✅ [Dashboard] localStorage 저장 완료. 저장된 데이터:', saved ? JSON.parse(saved) : null);
    
  navigate('/');
  };

  // 최적화 결과 삭제
  const handleDeleteOptimization = (id) => {
    const updated = savedOptimizations.filter(opt => opt.id !== id);
    setSavedOptimizations(updated);
    localStorage.setItem('savedOptimizations', JSON.stringify(updated));
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // 포트폴리오 통계 계산 (모든 가격이 이미 원화)
  const totalValue = userStocks.reduce((sum, stock) => {
    return sum + (stock.currentPrice * stock.quantity);
  }, 0);
  
  const totalCost = userStocks.reduce((sum, stock) => {
    return sum + (stock.purchasePrice * stock.quantity);
  }, 0);
  
  const totalProfit = totalValue - totalCost;
  const profitRate = totalCost > 0 ? ((totalValue / totalCost - 1) * 100) : 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('myPageHeader')}</h1>
          <p className="text-gray-600 mt-2">{t('manageHoldingsHelp')}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddStockModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus size={20} />
            {t('addStockBtn')}
          </button>
          <button 
            onClick={handleOptimize}
            disabled={userStocks.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Zap size={20} />
            {t('optimizeNow')}
          </button>
        </div>
      </div>

      {/* 포트폴리오 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-600 text-sm mb-2">{t('totalValueCard')}</p>
          <p className="text-2xl font-bold text-gray-900">₩{totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-600 text-sm mb-2">{t('totalCostCard')}</p>
          <p className="text-2xl font-bold text-gray-900">₩{totalCost.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-600 text-sm mb-2">{t('totalPnLCard')}</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalProfit >= 0 ? '+' : ''}₩{totalProfit.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <p className="text-gray-600 text-sm mb-2">{t('returnRateCard')}</p>
          <p className={`text-2xl font-bold ${profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl shadow-md p-6">
          <p className="text-blue-600 text-sm mb-2">💱 {t('usdkrw')}</p>
          <p className="text-xl font-bold text-blue-900">₩{exchangeRate.rate.toFixed(2)}</p>
          <p className="text-xs text-blue-600 mt-1">{t('updatedEvery10min')}</p>
        </div>
      </div>

      {/* 보유 종목 테이블 */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('holdingsTitle')}</h2>
          {userStocks.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="w-4 h-4" />
              <span className="text-xs">{t('itemsCount', { count: userStocks.length })}</span>
            </div>
          )}
        </div>
        
        {userStocks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">{t('noStocksYet')}</p>
            <button 
              onClick={() => setShowAddStockModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('addFirstStock')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">{t('colName')}</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">{t('colTicker')}</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">{t('colQuantity')}</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">{t('colPurchase')}</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">{t('colCurrent')}</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">{t('colValuation')}</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">{t('colPnL')}</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-semibold">{t('colDelete')}</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {userStocks.map((stock) => {
                  // 모든 가격이 이미 원화로 저장됨
                  const stockTotalValue = stock.currentPrice * stock.quantity;
                  const profit = (stock.currentPrice - stock.purchasePrice) * stock.quantity;
                  const profitRate = stock.purchasePrice > 0 ? ((stock.currentPrice / stock.purchasePrice - 1) * 100).toFixed(2) : 0;
                  
                  return (
                    <tr key={stock.ticker} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {stock.name}
                        {stock.isForeign && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{t('foreign')}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{stock.ticker}</td>
                      <td className="py-3 px-4 text-right text-gray-900">{stock.quantity}</td>
                      <td 
                        className={`py-3 px-4 text-right text-gray-900 ${stock.isAveraged ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                        onClick={() => stock.isAveraged && handleShowHistory(stock)}
                        title={stock.isAveraged ? t('clickToViewHistory') : ''}
                      >
                        ₩{Math.round(stock.purchasePrice).toLocaleString()}
                        {stock.isAveraged && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{t('avg')}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">₩{Math.round(stock.currentPrice).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">₩{Math.round(stockTotalValue).toLocaleString()}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit >= 0 ? <TrendingUp className="inline w-4 h-4 mr-1" /> : <TrendingDown className="inline w-4 h-4 mr-1" />}
                        {profit >= 0 ? '+' : ''}₩{Math.round(profit).toLocaleString()} ({profit >= 0 ? '+' : ''}{profitRate}%)
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleRemoveStock(stock.ticker)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <XCircle size={20} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 저장된 최적화 결과 */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('savedPortfolios')}</h2>
          <button
            onClick={fetchPortfolios}
            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={t('refreshTitle')}
          >
            <RefreshCw className="w-4 h-4" />
            {t('refreshTitle')}
          </button>
        </div>
        
        {savedPortfolios.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>{t('noSavedPortfolios')}</p>
            <p className="text-sm mt-2">{t('createAndSavePortfolio')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedPortfolios.map((portfolio) => {
              const totalValue = (portfolio.assets || []).reduce((sum, asset) => {
                const live = savedPriceMap[asset.ticker];
                const price = (typeof live === 'number') ? live : (asset.currentPrice ?? asset.purchasePrice ?? 0);
                return sum + (price * Number(asset.quantity || 0));
              }, 0);
              const totalCost = (portfolio.assets || []).reduce((sum, asset) => 
                sum + ((asset.purchasePrice ?? 0) * Number(asset.quantity || 0)), 0
              );
              const profitLoss = totalValue - totalCost;
              const profitRate = totalCost > 0 ? ((profitLoss / totalCost) * 100).toFixed(2) : 0;
              
              return (
              <div 
                key={portfolio.id} 
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedPortfolio(portfolio);
                  setShowPortfolioDetailModal(true);
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{portfolio.name}</h3>
                    <p className="text-sm text-gray-600">{new Date(portfolio.createdAt).toLocaleString('ko-KR')}</p>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await axios.delete(`/api/portfolios/${portfolio.id}`);
                        setSavedPortfolios(savedPortfolios.filter(p => p.id !== portfolio.id));
                      } catch (error) {
                        console.error('포트폴리오 삭제 실패:', error);
                      }
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">{t('colValuation')}</p>
                    <p className="font-semibold text-blue-600">₩{Math.round(totalValue).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('totalCostCard')}</p>
                    <p className="font-semibold text-gray-600">₩{Math.round(totalCost).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('colPnL')}</p>
                    <p className={`font-semibold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profitLoss >= 0 ? '+' : ''}₩{Math.round(profitLoss).toLocaleString()} ({profitRate}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('itemCountLabel')}</p>
                    <p className="font-semibold text-gray-900">{t('itemsCount', { count: portfolio.assets.length })}</p>
                  </div>
                </div>
                    {portfolio.assets && portfolio.assets.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {portfolio.assets.map((asset) => (
                        <span key={asset.ticker} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          {asset.displayName || asset.name} ({asset.ticker}): {Math.floor(Number(asset.quantity) || 0)}{t('shares')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* 종목 추가 모달 */}
      {showAddStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('addStockTitle')}</h2>
            
            {/* 종목 검색 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('stockSearch')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                )}
                
                {/* 검색 결과 드롭다운 */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((stock, index) => {
                      const isforeign = isForeignStock(stock.ticker);
                      return (
                        <button
                          key={index}
                          onClick={() => handleSelectStock(stock)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{stock.name}</span>
                            {isforeign && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('foreign')}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {stock.ticker} • {stock.exchange}
                            {isforeign && <span className="ml-2 text-blue-600">($)</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 선택된 종목 정보 */}
            {newStock.ticker && (
              <div>
                {/* 종목 유형 알림 */}
                {isForeignStock(newStock.ticker) && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 font-semibold">{t('foreignHoldingsBannerTitle')}</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {t('foreignHoldingsBannerDesc', { rate: exchangeRate.rate.toFixed(2) })}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('stockName')}</label>
                    <input
                      type="text"
                      value={newStock.name}
                      readOnly
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('colTicker')} {isForeignStock(newStock.ticker) && 
                        <span className="text-xs text-blue-600">({t('foreign')})</span>
                      }
                    </label>
                    <input
                      type="text"
                      value={newStock.ticker}
                      readOnly
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('colQuantity')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={newStock.quantity}
                      onChange={(e) => setNewStock({...newStock, quantity: e.target.value})}
                      placeholder="e.g., 10"
                      min="1"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('colPurchase')} (₩) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newStock.purchasePrice}
                    onChange={(e) => setNewStock({...newStock, purchasePrice: e.target.value})}
                    placeholder="Purchase price (₩)"
                    min="0"
                    step="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddStockModal(false);
                  setNewStock({ ticker: '', name: '', quantity: '', purchasePrice: '' });
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddStock}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 매입 이력 모달 */}
      {showHistoryModal && selectedStockHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedStockHistory.name}</h2>
                  <p className="text-gray-600 mt-1">{selectedStockHistory.ticker}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">평균 매수가</span>
                    {selectedStockHistory.isForeign && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">해외</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedStockHistory(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={28} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* 현재 요약 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">📊 현재 보유 현황</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">총 수량</p>
                    <p className="text-xl font-bold text-gray-900">{selectedStockHistory.quantity}주</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">평균 매수가</p>
                    <p className="text-xl font-bold text-blue-600">₩{Math.round(selectedStockHistory.purchasePrice).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">총 매입금액</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ₩{Math.round(selectedStockHistory.purchasePrice * selectedStockHistory.quantity).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">현재 평가금액</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ₩{Math.round(selectedStockHistory.currentPrice * selectedStockHistory.quantity).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* 매입 이력 */}
              <h3 className="font-semibold text-gray-900 mb-3">📝 매입 이력 ({selectedStockHistory.purchaseHistory?.length || 0}회)</h3>
              <div className="space-y-3">
                {selectedStockHistory.purchaseHistory && selectedStockHistory.purchaseHistory.length > 0 ? (
                  selectedStockHistory.purchaseHistory.map((history, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-700">매입 #{index + 1}</span>
                            <span className="text-xs text-gray-500">
                              {history.date ? new Date(history.date).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '날짜 정보 없음'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">매수가</p>
                              <p className="font-semibold text-gray-900">₩{Math.round(history.price).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">수량</p>
                              <p className="font-semibold text-gray-900">{history.quantity}주</p>
                            </div>
                            <div>
                              <p className="text-gray-600">매입금액</p>
                              <p className="font-semibold text-blue-600">₩{Math.round(history.price * history.quantity).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-4">매입 이력이 없습니다.</p>
                )}
              </div>

              {/* 닫기 버튼 */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedStockHistory(null);
                  }}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 포트폴리오 상세 모달 */}
      {showPortfolioDetailModal && selectedPortfolio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedPortfolio.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(selectedPortfolio.createdAt).toLocaleString('ko-KR')}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPortfolioDetailModal(false);
                  setSelectedPortfolio(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* AI 분석 요약 */}
            {selectedPortfolio.aiSummary && (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  {t('aiSummary')}
                </h3>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {selectedPortfolio.aiSummary}
                </div>
              </div>
            )}

            {/* 포트폴리오 통계 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {(() => {
                const totalValue = (selectedPortfolio.assets || []).reduce((sum, asset) => {
                  const live = savedPriceMap[asset.ticker];
                  const price = (typeof live === 'number') ? live : (asset.currentPrice ?? asset.purchasePrice ?? 0);
                  return sum + (price * Number(asset.quantity || 0));
                }, 0);
                const totalCost = (selectedPortfolio.assets || []).reduce((sum, asset) => 
                  sum + ((asset.purchasePrice ?? 0) * Number(asset.quantity || 0)), 0
                );
                const profitLoss = totalValue - totalCost;
                const profitRate = totalCost > 0 ? ((profitLoss / totalCost) * 100).toFixed(2) : 0;

                return (
                  <>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('colValuation')}</p>
                      <p className="text-xl font-bold text-blue-600">₩{Math.round(totalValue).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('totalCostCard')}</p>
                      <p className="text-xl font-bold text-gray-600">₩{Math.round(totalCost).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('colPnL')}</p>
                      <p className={`text-xl font-bold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitLoss >= 0 ? '+' : ''}₩{Math.round(profitLoss).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">{t('returnRateCard')}</p>
                      <p className={`text-xl font-bold ${profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitRate >= 0 ? '+' : ''}{profitRate}%
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 보유 종목 목록 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t('holdingsTitle')}</h3>
              <div className="space-y-3">
                {selectedPortfolio.assets && selectedPortfolio.assets.length > 0 ? (
                  selectedPortfolio.assets.map((asset) => {
                    const live = savedPriceMap[asset.ticker];
                    const currentPrice = (typeof live === 'number') ? live : (asset.currentPrice ?? asset.purchasePrice ?? 0);
                    const totalValue = currentPrice * Number(asset.quantity || 0);
                    const totalCost = (asset.purchasePrice ?? 0) * Number(asset.quantity || 0);
                    const profitLoss = totalValue - totalCost;
                    const profitRate = totalCost > 0 ? ((profitLoss / totalCost) * 100).toFixed(2) : 0;

                    return (
                      <div key={asset.ticker} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{asset.displayName || asset.name}</h4>
                            <p className="text-sm text-gray-600">{asset.ticker}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            profitRate >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {profitRate >= 0 ? '+' : ''}{profitRate}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">{t('colQuantity')}</p>
                            <p className="font-semibold text-gray-900">{Math.floor(Number(asset.quantity) || 0)}{t('shares')}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">{t('colPurchase')}</p>
                            <p className="font-semibold text-gray-900">₩{Math.round(asset.purchasePrice).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">{t('colCurrent')}</p>
                            <p className="font-semibold text-gray-900">₩{Math.round(currentPrice).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">{t('colValuation')}</p>
                            <p className="font-semibold text-blue-600">₩{Math.round(totalValue).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-gray-500 py-4">{t('noHoldings')}</p>
                )}
              </div>
            </div>

            {/* 닫기 버튼 */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowPortfolioDetailModal(false);
                  setSelectedPortfolio(null);
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
