def optimize_with_qaoa_integer(n, returns, covariance_matrix, risk_factor, constraints):
    """
    QAOA 기반 정수 최적화 함수. 필요한 인자를 모두 전달받아 동작.
    """
    try:
        print("Running QAOA integer optimization...", file=sys.stderr)
        from qiskit_optimization import QuadraticProgram
        from qiskit_optimization.algorithms import MinimumEigenOptimizer
        from qiskit_optimization.converters import QuadraticProgramToQubo

        # Quantum availability check
        if not QUANTUM_AVAILABLE:
            raise RuntimeError("Quantum libraries not available")

        # Extract constraints
        prices = constraints.get('prices')  # 종목별 현재가 리스트
        budget = constraints.get('budget')  # 총 투자금액
        min_shares = constraints.get('min_shares', np.zeros(n, dtype=int))
        max_shares = constraints.get('max_shares', np.full(n, 100, dtype=int))

        # Enforce 2-bit encoding (max 4 discrete levels per stock)
        rng_sizes = (np.array(max_shares, dtype=int) - np.array(min_shares, dtype=int) + 1)
        required_bits = np.ceil(np.log2(np.maximum(rng_sizes, 1))).astype(int)
        total_qubits = int(required_bits.sum())
        # If any variable needs more than 2 bits, cap its range to 4 levels
        if (required_bits > 2).any():
            max_shares_adj = np.minimum(np.array(max_shares, dtype=int), np.array(min_shares, dtype=int) + 3)
            print(f"Adjusting max_shares to enforce 2-bit encoding: {max_shares} -> {max_shares_adj}", file=sys.stderr)
            max_shares = max_shares_adj
            rng_sizes = (np.array(max_shares, dtype=int) - np.array(min_shares, dtype=int) + 1)
            required_bits = np.ceil(np.log2(np.maximum(rng_sizes, 1))).astype(int)
            total_qubits = int(required_bits.sum())

        # Safety: tighten qubit threshold; if too high (>10 => >1024 state dim), fall back fast
        if total_qubits > 10:
            raise MemoryError(f"QAOA qubits={total_qubits} too large; falling back to classical")

        # Build problem
        qp = QuadraticProgram('portfolio_integer')
        for i in range(n):
            qp.integer_var(name=f'share_{i}', lowerbound=int(min_shares[i]), upperbound=int(max_shares[i]))
        # Objective: maximize expected return - risk_factor * variance
        linear = {f'share_{i}': -returns[i] for i in range(n)}
        quadratic = {}
        risk_penalty = risk_factor * 2.0
        for i in range(n):
            for j in range(n):
                quadratic[(f'share_{i}', f'share_{j}')] = risk_penalty * covariance_matrix[i, j]
        qp.minimize(linear=linear, quadratic=quadratic)
        
    # Note: Budget constraint removed as QUBO cannot handle float inequality constraints
        # Instead, we rely on max_shares bounds (default: 100 shares per stock)
        # This simplifies the problem while still providing reasonable portfolio allocation
        # Convert to QUBO
        converter = QuadraticProgramToQubo()
        qubo = converter.convert(qp)
        sampler = Sampler()
        # Lightweight QAOA for speed: reps=1, maxiter=8
        qaoa = QAOA(sampler=sampler, optimizer=COBYLA(maxiter=8), reps=1)
        optimizer = MinimumEigenOptimizer(qaoa)
        result = optimizer.solve(qubo)
        shares = np.zeros(n, dtype=int)
        for i in range(n):
            var_name = f'share_{i}'
            if var_name in result.variables_dict:
                shares[i] = int(round(result.variables_dict[var_name]))
        
        print(f"✅ QAOA integer optimization completed: {shares}", file=sys.stderr)
        return shares
    except Exception as e:
        print(f"❌ QAOA integer optimization error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        # Return fallback: equal shares within budget
        if constraints and 'prices' in constraints and 'budget' in constraints:
            prices = constraints['prices']
            budget = constraints['budget']
            shares_per_stock = int(budget / (n * np.mean(prices)))
            fallback_shares = np.full(n, max(1, shares_per_stock))
            print(f"Using fallback shares: {fallback_shares}", file=sys.stderr)
            return fallback_shares
        return np.ones(n, dtype=int)


def shares_to_weights(shares, prices):
    """
    Convert integer shares to portfolio weights based on monetary value
    
    Args:
        shares: Array of integer share quantities
        prices: Array of stock prices
        
    Returns:
        weights: Normalized portfolio weights (sum to 1.0)
    """
    shares = np.array(shares)
    prices = np.array(prices)
    
    # Calculate monetary values
    values = shares * prices
    total_value = np.sum(values)
    
    # Handle edge case: no investment
    if total_value == 0:
        n = len(shares)
        return np.ones(n) / n
    
    # Normalize to weights
    weights = values / total_value
    return weights


#!/usr/bin/env python3
"""
Portfolio Optimization using Modern Portfolio Theory and Quantum Algorithms
Optimizes stock portfolio allocation based on risk and return
실시간 환율을 반영하여 모든 금액 계산에 적용
"""
def fetch_realtime_exchange_rate(base='USD', target='KRW', fallback=1350):
    """
    Fetch real-time exchange rate using yfinance. Fallback to default if failed.
    Now uses a more reliable public API.
    """
    try:
        import requests
        # ExchangeRate-API.com의 무료 API 엔드포인트 사용
        url = f"https://api.exchangerate-api.com/v4/latest/{base}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()  # HTTP 오류 발생 시 예외 발생
        data = response.json()
        rate = data.get('rates', {}).get(target)
        if rate:
            print(f"✅ 실시간 환율 fetch 성공 (API): {base}/{target}={rate}", file=sys.stderr)
            return float(rate)
        print(f"API 응답에 '{target}' 환율 없음, fallback 사용", file=sys.stderr)
        return fallback
    except Exception as e:
        print(f"환율 fetch 실패: {e}, fallback={fallback}", file=sys.stderr)
        return fallback

import json
import sys
import numpy as np
from datetime import datetime
import time

# Quantum computing imports
try:
    from qiskit import QuantumCircuit
    from qiskit.primitives import StatevectorSampler as Sampler
    from qiskit_algorithms import QAOA, VQE
    from qiskit_algorithms.optimizers import COBYLA, SLSQP
    from qiskit_optimization import QuadraticProgram
    from qiskit_optimization.algorithms import MinimumEigenOptimizer
    from qiskit_optimization.converters import QuadraticProgramToQubo
    from qiskit.circuit.library import TwoLocal
    QUANTUM_AVAILABLE = True
    print("✅ Quantum computing libraries loaded successfully", file=sys.stderr)
except ImportError as e:
    QUANTUM_AVAILABLE = False
    print(f"Warning: Qiskit not available. Quantum algorithms disabled. Error: {e}", file=sys.stderr)


def load_input_data(input_file):
    """Load optimization request data from JSON file"""
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        return json.load(f)


def fetch_real_historical_data(stocks, period='1y', use_real_data=True):
    """
    Fetch REAL historical stock data using yfinance
    Calculate actual returns and covariance from market data
    """
    if not use_real_data:
        return fetch_simulated_data(stocks)
    
    try:
        import yfinance as yf
        import pandas as pd
        
        print(f"Fetching real data for {len(stocks)} stocks, period: {period}...", file=sys.stderr)
        
        # Get stock symbols
        symbols = [stock['symbol'] for stock in stocks]
        
        # Download historical data
        data = yf.download(symbols, period=period, progress=False)
        
        if data.empty:
            print("Warning: No data fetched, falling back to simulation", file=sys.stderr)
            return fetch_simulated_data(stocks)
        
        # Calculate daily returns
        if len(symbols) == 1:
            prices = data['Close']
            returns_data = prices.pct_change().dropna()
            mean_returns = np.array([returns_data.mean() * 252])  # Annualized
            cov_matrix = np.array([[returns_data.std() ** 2 * 252]])  # Annualized
        else:
            prices = data['Close']
            returns_data = prices.pct_change().dropna()
            
            # Annualized returns (252 trading days)
            mean_returns = returns_data.mean() * 252
            
            # Annualized covariance matrix
            cov_matrix = returns_data.cov() * 252
            
            # Convert to numpy arrays
            mean_returns = mean_returns.values
            cov_matrix = cov_matrix.values
        
        print(f"✅ Real data fetched successfully", file=sys.stderr)
        print(f"Mean returns: {mean_returns}", file=sys.stderr)
        
        return mean_returns, cov_matrix
        
    except Exception as e:
        print(f"Error fetching real data: {e}", file=sys.stderr)
        print("Falling back to simulated data", file=sys.stderr)
        return fetch_simulated_data(stocks)


def fetch_simulated_data(stocks):
    """
    Simulated data based on risk levels (original implementation)
    Used as fallback when real data unavailable
    """
    n_stocks = len(stocks)
    
    # Fix random seed for consistent results based on stock symbols
    seed = sum([ord(c) for stock in stocks for c in stock['symbol']]) % 10000
    np.random.seed(seed)
    
    # Simulate returns based on risk levels
    returns = []
    for stock in stocks:
        risk = stock['riskLevel']
        expected_return = 0.05 + (risk / 100.0) * 0.15
        returns.append(expected_return)
    
    returns = np.array(returns)
    
    # Generate covariance matrix based on risk levels
    volatility = np.array([stock['riskLevel'] / 100.0 * 0.3 for stock in stocks])
    correlation_matrix = np.random.uniform(0.3, 0.7, (n_stocks, n_stocks))
    np.fill_diagonal(correlation_matrix, 1.0)
    correlation_matrix = (correlation_matrix + correlation_matrix.T) / 2
    
    covariance_matrix = np.outer(volatility, volatility) * correlation_matrix
    
    return returns, covariance_matrix


def fetch_historical_data(stocks, use_real_data=True):
    """
    Main function to fetch historical data
    Supports both real and simulated data
    """
    return fetch_real_historical_data(stocks, period='1y', use_real_data=use_real_data)


def build_portfolio_optimization_problem(returns, covariance_matrix, risk_factor):
    """
    Build portfolio optimization using Mean-Variance Optimization
    """
    if returns is None or len(returns) == 0:
        raise ValueError("Returns data is empty or None")
    if covariance_matrix is None:
        raise ValueError("Covariance matrix is None")
    n = len(returns)
    return n, returns, covariance_matrix, risk_factor


def optimize_with_modern_portfolio_theory(n, returns, covariance_matrix, risk_factor, constraints=None):
    # 정수 최적화 옵션이 constraints에 있으면 정수 주식 개수로 최적화
    if constraints is not None and constraints.get('integer_optimization', False):
        try:
            from scipy.optimize import linprog
            prices = constraints.get('prices')  # 종목별 현재가 리스트
            budget = constraints.get('budget')  # 총 투자금액
            min_shares = constraints.get('min_shares', np.zeros(n, dtype=int))
            max_shares = constraints.get('max_shares', np.full(n, 100, dtype=int))
            # 목표: sum(returns[i] * shares[i]) 최대화
            c = -np.array(returns)  # linprog는 최소화이므로 -수익률
            # 제약조건: sum(prices[i] * shares[i]) <= budget
            A_ub = [prices]
            b_ub = [budget]
            # 정수 제약: integrality
            integrality = np.ones(n, dtype=int)
            # bounds: 각 종목별 최소/최대 주식 수
            bounds = [(min_shares[i], max_shares[i]) for i in range(n)]
            # linprog (scipy >=1.6, method='highs', integrality 지원)
            result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, integrality=integrality, method='highs')
            if result.success:
                shares = np.round(result.x).astype(int)
                return shares
            else:
                print(f"Integer optimization failed: {result.message}", file=sys.stderr)
        except Exception as e:
            print(f"Integer optimization error: {e}", file=sys.stderr)
        # 실패 시 기존 방식으로 비율 최적화 계속 진행
    """
    Run Modern Portfolio Theory optimization
    Uses analytical solution for optimal portfolio weights with optional constraints
    
    constraints: dict with 'min_weights' and 'max_weights' arrays
    """
    try:
        from scipy.optimize import minimize
        
        # If no constraints, use simple analytical solution
        if constraints is None:
            # Calculate inverse covariance matrix
            inv_cov = np.linalg.inv(covariance_matrix)
            
            # Optimal weights with risk aversion parameter
            ones = np.ones(n)
            
            # Mean-variance optimization formula
            # w = (1/lambda) * Sigma^-1 * mu
            # where lambda is risk aversion coefficient
            risk_aversion = 2.0 / risk_factor if risk_factor > 0 else 1.0
            
            # Calculate optimal weights
            weights = np.dot(inv_cov, returns) / risk_aversion
            
            # Normalize to sum to 1
            if weights.sum() > 0:
                weights = weights / weights.sum()
            else:
                weights = np.ones(n) / n
            
            # Ensure all weights are non-negative (long-only portfolio)
            weights = np.maximum(weights, 0)
            weights = weights / weights.sum()
            
            return weights
        
        # With constraints, use scipy optimizer
        min_weights = constraints.get('min_weights', np.zeros(n))
        max_weights = constraints.get('max_weights', np.ones(n))
        
        # Objective function: maximize Sharpe ratio (minimize negative Sharpe)
        def objective(w):
            portfolio_return = np.dot(w, returns)
            portfolio_variance = np.dot(w, np.dot(covariance_matrix, w))
            portfolio_risk = np.sqrt(portfolio_variance)
            
            risk_free_rate = 0.02
            sharpe = (portfolio_return - risk_free_rate) / portfolio_risk if portfolio_risk > 0 else 0
            
            return -sharpe  # Minimize negative Sharpe = Maximize Sharpe
        
        # Constraints
        constraints_list = [
            {'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0}  # Weights sum to 1
        ]
        
        # Bounds for each weight
        bounds = [(min_weights[i], max_weights[i]) for i in range(n)]
        
        # Initial guess (equal weights within bounds)
        initial_weights = np.array([
            (min_weights[i] + max_weights[i]) / 2 for i in range(n)
        ])
        initial_weights = initial_weights / initial_weights.sum()
        
        # Optimize
        result = minimize(
            objective,
            initial_weights,
            method='SLSQP',
            bounds=bounds,
            constraints=constraints_list,
            options={'maxiter': 1000}
        )
        
        if result.success:
            weights = result.x
            # Ensure weights sum to 1 and are within bounds
            weights = np.clip(weights, min_weights, max_weights)
            weights = weights / weights.sum()
            return weights
        else:
            print(f"Optimization with constraints failed: {result.message}", file=sys.stderr)
            # Return feasible weights within constraints
            weights = initial_weights
            return weights
        
    except Exception as e:
        print(f"Portfolio optimization failed: {e}", file=sys.stderr)
        # Fallback to equal weights
        return np.ones(n) / n


def calculate_allocations(stocks, weights):
    """
    Calculate portfolio allocations based on optimization weights
    """
    # weights 정규화 (합이 1이 아니면 1로 맞춤)
    weights = np.array(weights)
    if weights.sum() > 0:
        weights = weights / weights.sum()
    else:
        weights = np.ones(len(weights)) / len(weights)
    allocations = {}
    for i, stock in enumerate(stocks):
        symbol = stock['symbol']
        allocation_pct = float(weights[i] * 100)
        allocations[symbol] = round(allocation_pct, 2)
    return allocations

# 주식 개수로 배분 결과 반환
def calculate_share_allocations(stocks, weights):
    weights = np.array(weights)
    if weights.sum() > 0:
        weights = weights / weights.sum()
    else:
        weights = np.ones(len(weights)) / len(weights)
    total_value = sum(stock['quantity'] * stock['currentPrice'] for stock in stocks)
    share_allocations = {}
    for i, stock in enumerate(stocks):
        symbol = stock['symbol']
        unit_price = stock.get('currentPrice', 1)
        allocated_value = weights[i] * total_value
        allocated_count = int(allocated_value // unit_price) if unit_price > 0 else 0
        share_allocations[symbol] = allocated_count
    return share_allocations


def calculate_portfolio_metrics(returns, covariance_matrix, weights):
    """Calculate portfolio performance metrics"""
    # Expected return
    portfolio_return = float(np.dot(weights, returns))
    
    # Portfolio risk (standard deviation)
    portfolio_variance = np.dot(weights, np.dot(covariance_matrix, weights))
    portfolio_risk = float(np.sqrt(portfolio_variance))
    
    # Sharpe ratio (assuming risk-free rate = 0.02)
    risk_free_rate = 0.02
    sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_risk if portfolio_risk > 0 else 0
    
    return {
        'expectedReturn': round(portfolio_return * 100, 2),
        'expectedRisk': round(portfolio_risk * 100, 2),
        'sharpeRatio': round(sharpe_ratio, 3)
    }


def generate_efficient_frontier(returns, covariance_matrix, num_portfolios=100):
    """
    Generate efficient frontier data
    Returns list of portfolios on the efficient frontier
    """
    n_assets = len(returns)
    results = []
    
    # Generate random portfolios
    np.random.seed(42)  # For reproducibility
    
    for _ in range(num_portfolios):
        # Random weights
        weights = np.random.random(n_assets)
        weights = weights / np.sum(weights)
        
        # Calculate metrics
        portfolio_return = np.dot(weights, returns)
        portfolio_variance = np.dot(weights, np.dot(covariance_matrix, weights))
        portfolio_risk = np.sqrt(portfolio_variance)
        
        risk_free_rate = 0.02
        sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_risk if portfolio_risk > 0 else 0
        
        results.append({
            'risk': round(portfolio_risk * 100, 2),
            'return': round(portfolio_return * 100, 2),
            'sharpe': round(sharpe_ratio, 3)
        })
    
    # Sort by risk
    results.sort(key=lambda x: x['risk'])
    
    # Filter to get efficient frontier (remove dominated portfolios)
    efficient_frontier = []
    max_return = -float('inf')
    
    for portfolio in results:
        if portfolio['return'] > max_return:
            max_return = portfolio['return']
            efficient_frontier.append(portfolio)
    
    return efficient_frontier


def backtest_optimization(stocks, periods=['3mo', '6mo', '1y']):
    """
    Backtest optimization: simulate past optimization and compare with actual results
    
    For each period:
    1. Fetch data up to [period] ago
    2. Run optimization with that historical data
    3. Fetch actual returns from then to now
    4. Compare predicted vs actual performance
    """
    try:
        import yfinance as yf
        import pandas as pd
        from dateutil.relativedelta import relativedelta
        
        symbols = [stock['symbol'] for stock in stocks]
        backtest_results = []
        
        print(f"Starting backtest for {len(symbols)} stocks...", file=sys.stderr)
        
        for period in periods:
            try:
                # Parse period (e.g., '3mo' -> 3 months)
                if period.endswith('mo'):
                    months = int(period[:-2])
                    lookback_date = datetime.now() - relativedelta(months=months)
                elif period.endswith('y'):
                    years = int(period[:-1])
                    lookback_date = datetime.now() - relativedelta(years=years)
                else:
                    continue
                
                # 1. Fetch historical data UP TO lookback_date (for optimization)
                training_start = lookback_date - relativedelta(years=1)
                data_training = yf.download(
                    symbols, 
                    start=training_start.strftime('%Y-%m-%d'),
                    end=lookback_date.strftime('%Y-%m-%d'),
                    progress=False
                )
                
                if data_training.empty:
                    print(f"Warning: No training data for period {period}", file=sys.stderr)
                    continue
                
                # Calculate returns and covariance from training data
                if len(symbols) == 1:
                    prices_train = data_training['Close']
                    returns_train = prices_train.pct_change().dropna()
                    mean_returns_train = np.array([returns_train.mean() * 252])
                    cov_matrix_train = np.array([[returns_train.std() ** 2 * 252]])
                else:
                    prices_train = data_training['Close']
                    returns_train = prices_train.pct_change().dropna()
                    mean_returns_train = returns_train.mean().values * 252
                    cov_matrix_train = returns_train.cov().values * 252
                
                # 2. Optimize portfolio based on training data
                n_stocks = len(symbols)
                risk_factor = 5.0  # Default risk level
                optimal_weights = optimize_with_modern_portfolio_theory(
                    n_stocks, mean_returns_train, cov_matrix_train, risk_factor
                )
                predicted_metrics = calculate_portfolio_metrics(
                    mean_returns_train, cov_matrix_train, optimal_weights
                )
                
                # 3. Fetch actual data FROM lookback_date TO now
                data_actual = yf.download(
                    symbols,
                    start=lookback_date.strftime('%Y-%m-%d'),
                    end=datetime.now().strftime('%Y-%m-%d'),
                    progress=False
                )
                
                if data_actual.empty:
                    print(f"Warning: No actual data for period {period}", file=sys.stderr)
                    continue
                
                # Calculate actual returns
                if len(symbols) == 1:
                    prices_actual = data_actual['Close']
                    returns_actual = prices_actual.pct_change().dropna()
                    mean_returns_actual = np.array([returns_actual.mean() * 252])
                    cov_matrix_actual = np.array([[returns_actual.std() ** 2 * 252]])
                else:
                    prices_actual = data_actual['Close']
                    returns_actual = prices_actual.pct_change().dropna()
                    mean_returns_actual = returns_actual.mean().values * 252
                    cov_matrix_actual = returns_actual.cov().values * 252
                
                # 4. Calculate actual metrics with optimized weights
                actual_metrics = calculate_portfolio_metrics(
                    mean_returns_actual, cov_matrix_actual, optimal_weights
                )
                
                # Also calculate equal-weight baseline
                equal_weights = np.ones(len(symbols)) / len(symbols)
                baseline_metrics = calculate_portfolio_metrics(
                    mean_returns_actual, cov_matrix_actual, equal_weights
                )
                
                backtest_results.append({
                    'period': period,
                    'lookbackDate': lookback_date.strftime('%Y-%m-%d'),
                    'predicted': {
                        'return': round(predicted_metrics['expectedReturn'], 2),
                        'risk': round(predicted_metrics['expectedRisk'], 2),
                        'sharpe': round(predicted_metrics['sharpeRatio'], 3)
                    },
                    'actual': {
                        'return': round(actual_metrics['expectedReturn'], 2),
                        'risk': round(actual_metrics['expectedRisk'], 2),
                        'sharpe': round(actual_metrics['sharpeRatio'], 3)
                    },
                    'baseline': {
                        'return': round(baseline_metrics['expectedReturn'], 2),
                        'risk': round(baseline_metrics['expectedRisk'], 2),
                        'sharpe': round(baseline_metrics['sharpeRatio'], 3)
                    },
                    'outperformance': round(actual_metrics['expectedReturn'] - baseline_metrics['expectedReturn'], 2)
                })
                
                print(f"✅ Backtest for {period}: Predicted {predicted_metrics['expectedReturn']:.1f}%, Actual {actual_metrics['expectedReturn']:.1f}%", file=sys.stderr)
                
            except Exception as e:
                print(f"Error in backtest for period {period}: {e}", file=sys.stderr)
                continue
        
        return backtest_results
        
    except ImportError:
        print("Warning: yfinance or dateutil not available for backtesting", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error in backtesting: {e}", file=sys.stderr)
        return []


def generate_optimization_reason(stocks, weights, returns, covariance_matrix, metrics, target_risk):
    """Generate detailed optimization strategy explanation with reasoning"""
    n_stocks = len(stocks)
    portfolio_return = metrics['expectedReturn']
    portfolio_risk = metrics['expectedRisk']
    sharpe_ratio = metrics['sharpeRatio']
    
    # Calculate correlations between stocks
    if n_stocks > 1:
        # Calculate correlation from covariance matrix
        std_devs = np.sqrt(np.diag(covariance_matrix))
        correlation_matrix = covariance_matrix / np.outer(std_devs, std_devs)
        # Get average correlation (excluding diagonal)
        avg_correlation = np.mean(np.abs(correlation_matrix[np.triu_indices_from(correlation_matrix, k=1)]))
    else:
        correlation_matrix = np.array([[1.0]])
        avg_correlation = 0.0
    
    # Find top allocated stocks with details
    stock_details = []
    for i in range(n_stocks):
        stock_details.append({
            'name': stocks[i]['name'],
            'symbol': stocks[i]['symbol'],
            'weight': weights[i] * 100,
            'return': returns[i] * 100,
            'risk': stocks[i].get('riskLevel', target_risk),  # Use target_risk as default
            'variance': covariance_matrix[i, i]
        })
    stock_details.sort(key=lambda x: x['weight'], reverse=True)
    
    # Generate comprehensive reason
    reason = f"## 🎯 최적화 분석 결과\n\n"
    reason += f"위험 수준 {target_risk}/10에 맞춰 **위험 대비 최대 수익**을 추구하는 포트폴리오를 구성했습니다.\n\n"
    
    # Portfolio characteristics
    reason += f"### 📊 최적화된 포트폴리오 특성\n\n"
    reason += f"| 지표 | 값 | 평가 |\n"
    reason += f"|------|------|------|\n"
    reason += f"| **예상 연간 수익률** | {portfolio_return:.2f}% | "
    if portfolio_return > 20:
        reason += "매우 높음 🚀 |\n"
    elif portfolio_return > 10:
        reason += "높음 📈 |\n"
    elif portfolio_return > 5:
        reason += "적정 ✅ |\n"
    else:
        reason += "보수적 🛡️ |\n"
    
    reason += f"| **포트폴리오 변동성** | {portfolio_risk:.2f}% | "
    if portfolio_risk < 15:
        reason += "낮음 (안정적) |\n"
    elif portfolio_risk < 25:
        reason += "적정 |\n"
    else:
        reason += "높음 (주의) |\n"
    
    reason += f"| **샤프 지수** | {sharpe_ratio:.3f} | "
    if sharpe_ratio > 2.0:
        reason += "매우 우수 ⭐⭐⭐ |\n"
    elif sharpe_ratio > 1.0:
        reason += "우수 ⭐⭐ |\n"
    elif sharpe_ratio > 0.5:
        reason += "양호 ⭐ |\n"
    else:
        reason += "개선 필요 |\n"
    
    reason += f"| **종목 간 평균 상관계수** | {avg_correlation:.3f} | "
    if avg_correlation < 0.3:
        reason += "분산 효과 높음 ✅ |\n"
    elif avg_correlation < 0.6:
        reason += "적정한 분산 |\n"
    else:
        reason += "분산 효과 낮음 ⚠️ |\n"
    
    reason += f"\n"
    
    # 3. Why these weights?
    reason += f"### 🎯 종목별 배분 근거\n\n"
    for idx, stock in enumerate(stock_details[:5], 1):  # Top 5 stocks
        reason += f"**{idx}. {stock['name']} ({stock['symbol']})** - {stock['weight']:.1f}%\n"
        reason += f"```\n"
        reason += f"• 예상 수익률: {stock['return']:.2f}% (연간)\n"
        risk_level = stock.get('risk') or stock.get('riskLevel') or 5
        reason += f"• 개별 위험도: {int(risk_level) if risk_level is not None else 5}/10\n"
        reason += f"• 개별 변동성: {np.sqrt(stock['variance']) * 100:.2f}%\n"
        
        # Reasoning for this weight
        if stock['weight'] > 30:
            reason += f"• 비중 이유: 높은 수익률({stock['return']:.1f}%)과 적절한 리스크로 핵심 보유 종목\n"
        elif stock['weight'] >= 20:
            reason += f"• 비중 이유: 우수한 수익률과 포트폴리오 안정성 기여\n"
        elif stock['weight'] > 10:
            reason += f"• 비중 이유: 분산투자 효과로 전체 리스크 감소\n"
        else:
            reason += f"• 비중 이유: 소량 보유로 추가 분산 효과 제공\n"
        
        reason += f"```\n\n"
    
    # 4. Strategy explanation
    reason += f"### 💭 최적화 전략 설명\n\n"
    
    if sharpe_ratio > 1.5:
        reason += f"**✅ 위험 대비 수익이 매우 우수한 포트폴리오**\n\n"
        reason += f"샤프 지수 {sharpe_ratio:.3f}는 투자한 위험 1단위당 {sharpe_ratio:.2f}배의 초과수익을 얻을 수 있음을 의미합니다. "
        reason += f"이는 시장 평균(샤프 지수 1.0)을 크게 상회하는 수준으로, **현재 포트폴리오 구성이 매우 효율적**입니다.\n\n"
    elif sharpe_ratio > 1.0:
        reason += f"**✅ 균형 잡힌 리스크-수익 구조**\n\n"
        reason += f"샤프 지수 {sharpe_ratio:.3f}는 적절한 위험 관리 하에서 양호한 수익을 추구하는 포트폴리오입니다. "
        reason += f"시장 평균 수준의 효율성을 보이고 있습니다.\n\n"
    else:
        reason += f"**⚠️ 보수적인 포트폴리오**\n\n"
        reason += f"샤프 지수 {sharpe_ratio:.3f}는 안정성을 중시하는 구성입니다. "
        reason += f"더 높은 수익을 원하신다면 고수익 종목 비중을 늘려보세요.\n\n"
    
    # Risk level assessment
    if portfolio_risk < target_risk * 0.8:
        reason += f"**📌 위험 수준 평가:** 목표({target_risk})보다 낮은 변동성({portfolio_risk:.1f}%)으로 **매우 안정적**이지만, "
        reason += f"더 공격적인 투자를 원하신다면 고수익 종목 비중을 늘릴 수 있습니다.\n\n"
    elif portfolio_risk > target_risk * 1.3:
        reason += f"**⚠️ 위험 수준 평가:** 목표({target_risk})보다 높은 변동성({portfolio_risk:.1f}%)으로 **변동성 주의**가 필요합니다. "
        reason += f"단기 손실 가능성을 염두에 두시고, 필요시 안정적인 종목 비중을 늘리세요.\n\n"
    else:
        reason += f"**✅ 위험 수준 평가:** 목표 위험 수준({target_risk})에 부합하는 변동성({portfolio_risk:.1f}%)으로 **적정한 포트폴리오**입니다.\n\n"
    
    # Diversification effect
    if avg_correlation < 0.4:
        reason += f"**🎯 분산투자 효과:** 종목 간 상관계수가 {avg_correlation:.3f}로 낮아 **탁월한 분산투자 효과**를 보입니다. "
        reason += f"각 종목이 서로 다른 시장 상황에서 보완적으로 작동하여 전체 포트폴리오의 안정성을 높입니다.\n\n"
    elif avg_correlation < 0.7:
        reason += f"**🎯 분산투자 효과:** 종목 간 상관계수가 {avg_correlation:.3f}로 **적절한 분산효과**를 보입니다.\n\n"
    else:
        reason += f"**⚠️ 분산투자 효과:** 종목 간 상관계수가 {avg_correlation:.3f}로 높아 **분산효과가 제한적**입니다. "
        reason += f"서로 다른 산업군의 종목을 추가하면 리스크를 더 낮출 수 있습니다.\n\n"
    
    return reason


def generate_recommendation_reasons(stocks, weights, current_weights, returns, total_investment):
    """Generate detailed reasons for each stock recommendation"""
    reasons = {}
    
    # Calculate average return for comparison
    if returns is not None and len(returns) > 0:
        avg_return = np.mean(returns) * 100
    else:
        avg_return = 0.0
    
    for i, stock in enumerate(stocks):
        symbol = stock['symbol']
        name = stock['name']
        optimal_weight = weights[i] * 100
        current_weight = current_weights[i] * 100
        expected_return = returns[i] * 100
        risk_level = stock.get('riskLevel', 5.0)  # Default to 5.0 if None
        if risk_level is None:
            risk_level = 5.0
        
        diff = optimal_weight - current_weight
        
        if abs(diff) < 2:
            # 유지 추천
            reason = f"**✅ {name} 보유 비중 유지**\n\n"
            reason += f"현재 비중 **{current_weight:.1f}%**가 최적 수준에 근접합니다.\n\n"
            reason += f"**현재 상태:**\n"
            reason += f"• 예상 연간 수익률: {expected_return:.1f}%\n"
            reason += f"• 위험도: {risk_level}/10\n"
            reason += f"• 포트폴리오 기여도: 적정\n\n"
            reason += f"**유지 이유:**\n"
            reason += f"• 현재 비중이 리스크-수익 균형에 최적화되어 있습니다\n"
            reason += f"• 추가 조정 시 거래비용만 발생하고 개선 효과가 미미합니다\n"
            reason += f"• 포트폴리오 전체 안정성에 적절히 기여하고 있습니다"
            reasons[symbol] = reason
            
        elif diff > 0:
            # 매수 추천
            reason = f"**📈 {name} 비중 증가 ({current_weight:.1f}% → {optimal_weight:.1f}%)**\n\n"
            recommended_amount = total_investment * abs(diff) / 100
            reason += f"**{abs(diff):.1f}%p 증가**를 추천합니다 (약 ₩{recommended_amount:,.0f} 추가 투자)\n\n"
            
            reason += f"**증가 추천 이유:**\n\n"
            
            # Reason 1: Return analysis
            if expected_return > avg_return * 1.2:
                reason += f"1. **높은 수익 잠재력** 🎯\n"
                reason += f"   - 예상 연간 수익률: **{expected_return:.1f}%**\n"
                reason += f"   - 포트폴리오 평균({avg_return:.1f}%)보다 **{expected_return - avg_return:.1f}%p 높음**\n"
                reason += f"   - 고수익 종목으로 전체 포트폴리오 수익률 향상에 기여\n\n"
            elif expected_return > avg_return:
                reason += f"1. **안정적인 수익 기대** 📊\n"
                reason += f"   - 예상 연간 수익률: **{expected_return:.1f}%**\n"
                reason += f"   - 포트폴리오 평균 이상의 성과 기대\n\n"
            
            # Reason 2: Risk analysis
            if risk_level < 5:
                reason += f"2. **낮은 위험도로 안정적** 🛡️\n"
                reason += f"   - 위험도: **{risk_level}/10** (낮음)\n"
                reason += f"   - 변동성이 낮아 포트폴리오 전체 리스크 감소\n"
                reason += f"   - 시장 하락 시에도 손실 제한 효과\n\n"
            elif risk_level <= 7:
                reason += f"2. **적정한 위험 수준** ⚖️\n"
                reason += f"   - 위험도: **{risk_level}/10** (중간)\n"
                reason += f"   - 수익-리스크 균형이 좋은 종목\n\n"
            else:
                reason += f"2. **고위험-고수익 전략** 🚀\n"
                reason += f"   - 위험도: **{risk_level}/10** (높음)\n"
                reason += f"   - 높은 변동성이지만 대규모 수익 기회\n"
                reason += f"   - 분산투자로 리스크 관리 필요\n\n"
            
            # Reason 3: Portfolio optimization
            reason += f"3. **포트폴리오 최적화 효과** 💡\n"
            reason += f"   - 다른 종목과의 **분산 효과**로 전체 리스크 감소\n"
            reason += f"   - 샤프 지수(위험 대비 수익) 개선\n"
            reason += f"   - 목표 위험 수준 내에서 수익 극대화\n\n"
            
            reason += f"**투자 전략:** 비중을 늘려 포트폴리오 효율성을 높이세요."
            reasons[symbol] = reason
            
        else:
            # 매도 추천
            reason = f"**📉 {name} 비중 감소 ({current_weight:.1f}% → {optimal_weight:.1f}%)**\n\n"
            recommended_amount = total_investment * abs(diff) / 100
            reason += f"**{abs(diff):.1f}%p 감소**를 추천합니다 (약 ₩{recommended_amount:,.0f} 매도)\n\n"
            
            reason += f"**감소 추천 이유:**\n\n"
            
            # Reason 1: Return analysis
            if expected_return < avg_return * 0.8:
                reason += f"1. **상대적으로 낮은 수익률** 📊\n"
                reason += f"   - 예상 연간 수익률: **{expected_return:.1f}%**\n"
                reason += f"   - 포트폴리오 평균({avg_return:.1f}%)보다 **{abs(expected_return - avg_return):.1f}%p 낮음**\n"
                reason += f"   - 더 높은 수익 종목으로 자금 재배치 필요\n\n"
            elif expected_return < avg_return:
                reason += f"1. **수익률 개선 여지** 📈\n"
                reason += f"   - 예상 수익률: **{expected_return:.1f}%**\n"
                reason += f"   - 다른 종목 대비 성과가 낮은 편\n\n"
            
            # Reason 2: Risk analysis
            if risk_level > 7:
                reason += f"2. **높은 변동성 리스크** ⚠️\n"
                reason += f"   - 위험도: **{risk_level}/10** (높음)\n"
                reason += f"   - 과도한 비중은 포트폴리오 전체 변동성 증가\n"
                reason += f"   - 시장 하락 시 큰 손실 가능성\n\n"
            else:
                reason += f"2. **효율성 개선** 🎯\n"
                reason += f"   - 현재 비중이 최적 수준보다 높음\n"
                reason += f"   - 비중 조정으로 다른 종목 투자 기회 확보\n\n"
            
            # Reason 3: Concentration risk
            if current_weight > 30:
                reason += f"3. **집중 리스크 완화** 🛡️\n"
                reason += f"   - 현재 비중({current_weight:.1f}%)이 지나치게 높음\n"
                reason += f"   - 특정 종목 의존도가 높아 위험\n"
                reason += f"   - 분산투자로 안정성 확보 필요\n\n"
            else:
                reason += f"3. **포트폴리오 리밸런싱** ⚖️\n"
                reason += f"   - 다른 고수익 종목으로 자금 재배치\n"
                reason += f"   - 전체 포트폴리오 샤프 지수 개선\n"
                reason += f"   - 더 효율적인 리스크-수익 구조 구축\n\n"
            
            reason += f"**투자 전략:** 비중을 줄여 자금을 더 효율적으로 배분하세요."
            reasons[symbol] = reason
    
    return reasons


def optimize_with_qaoa(n, returns, covariance_matrix, risk_factor, constraints=None):
    """
    Portfolio optimization using 2-bit QAOA + MPT hybrid
    Phase 1: QAOA integer optimization (lightweight, 2-bit encoding)
    Phase 2: MPT refinement for precision
    
    Args:
        n: Number of assets
        returns: Expected returns
        covariance_matrix: Covariance matrix
        risk_factor: Risk tolerance
        constraints: Dict with 'prices', 'budget', 'min_shares', 'max_shares'
    """
    if not QUANTUM_AVAILABLE:
        print("QAOA not available, falling back to MPT", file=sys.stderr)
        return optimize_with_modern_portfolio_theory(n, returns, covariance_matrix, risk_factor)
    
    if not constraints or 'prices' not in constraints:
        print("⚠️ No constraints provided, falling back to 1-bit QAOA", file=sys.stderr)
        return optimize_with_qaoa_1bit_fallback(n, returns, covariance_matrix, risk_factor)
    
    try:
        print("🔷 Phase 1: QAOA 2-bit integer optimization...", file=sys.stderr)
        start_time = time.time()
        
        # Phase 1: QAOA integer optimization
        shares = optimize_with_qaoa_integer(n, returns, covariance_matrix, risk_factor, constraints)
        qaoa_time = time.time() - start_time
        print(f"   QAOA phase: {qaoa_time:.2f}s", file=sys.stderr)
        
        # Phase 2: Convert shares to weights
        print("🔶 Phase 2: Converting shares to weights...", file=sys.stderr)
        prices = np.array(constraints['prices'])
        qaoa_weights = shares_to_weights(shares, prices)
        print(f"   Initial weights: {qaoa_weights}", file=sys.stderr)
        
        # Phase 3: MPT refinement with realistic constraints
        print("🔷 Phase 3: MPT refinement with optimization...", file=sys.stderr)
        mpt_start = time.time()
        
        from scipy.optimize import minimize
        
        def portfolio_objective(w):
            portfolio_return = np.dot(w, returns)
            portfolio_risk = np.sqrt(np.dot(w.T, np.dot(covariance_matrix, w)))
            return risk_factor * portfolio_risk - (1 - risk_factor) * portfolio_return
        
        constraints_opt = {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}
        
        # Realistic bounds: allow optimization to find optimal allocation
        # Allow 0% to 80% per stock for proper optimization
        min_weight_per_stock = 0.0   # Allow 0% (no forced allocation)
        max_weight_per_stock = 0.8   # Maximum 80% per stock
        bounds = tuple((min_weight_per_stock, max_weight_per_stock) for _ in range(n))
        
        print(f"   Enforcing diversification: {min_weight_per_stock*100}%-{max_weight_per_stock*100}% per stock", file=sys.stderr)
        
        result = minimize(
            portfolio_objective,
            x0=qaoa_weights,  # Use QAOA result as initial guess
            method='SLSQP',
            bounds=bounds,
            constraints=constraints_opt,
            options={'maxiter': 100, 'ftol': 1e-9}
        )
        
        mpt_time = time.time() - mpt_start
        print(f"   MPT phase: {mpt_time:.2f}s", file=sys.stderr)
        
        final_weights = result.x if result.success else qaoa_weights
        print(f"   Final diversified weights: {final_weights}", file=sys.stderr)
        
        total_time = time.time() - start_time
        print(f"✅ QAOA+MPT completed in {total_time:.2f}s", file=sys.stderr)
        
        return final_weights
        
    except Exception as e:
        print(f"❌ QAOA+MPT optimization failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        print("Falling back to MPT", file=sys.stderr)
        return optimize_with_modern_portfolio_theory(n, returns, covariance_matrix, risk_factor)


def optimize_with_qaoa_1bit_fallback(n, returns, covariance_matrix, risk_factor):
    """
    Fallback 1-bit QAOA (original implementation)
    Used when constraints are not available
    """
    try:
        print("🔷 Running 1-bit QAOA optimization...", file=sys.stderr)
        start_time = time.time()
        
        # Create quadratic program for portfolio optimization
        qp = QuadraticProgram('portfolio')
        
        # Add binary variables for each asset (discretized weights)
        # 1 bit = 0%/100% only (fast, MPT will enforce diversification)
        # 2 bits = 0%/33%/66%/100% (slow, 64x more states)
        # Using 1-bit for speed + MPT post-processing
        bits_per_asset = 1  # Binary: fast optimization, 19-22s for 6 stocks
        max_weight_value = 2**bits_per_asset - 1
        
        # Add variables
        for i in range(n):
            for bit in range(bits_per_asset):
                qp.binary_var(f'x_{i}_{bit}')
        
        # Objective: Maximize return - risk_factor * variance
        # Simplified objective for quantum optimization
        linear_coeffs = {}
        quadratic_coeffs = {}
        
        # Linear terms (returns)
        for i in range(n):
            for bit in range(bits_per_asset):
                bit_value = 2**bit / max_weight_value
                var_name = f'x_{i}_{bit}'
                linear_coeffs[var_name] = -returns[i] * bit_value  # Negative for minimization
        
        # Quadratic terms (risk penalty)
        risk_penalty = risk_factor * 2.0
        for i in range(n):
            for j in range(n):
                for bit_i in range(bits_per_asset):
                    for bit_j in range(bits_per_asset):
                        bit_value_i = 2**bit_i / max_weight_value
                        bit_value_j = 2**bit_j / max_weight_value
                        var_i = f'x_{i}_{bit_i}'
                        var_j = f'x_{j}_{bit_j}'
                        coeff = risk_penalty * covariance_matrix[i, j] * bit_value_i * bit_value_j
                        quadratic_coeffs[(var_i, var_j)] = coeff
        
        # Set objective
        qp.minimize(linear=linear_coeffs, quadratic=quadratic_coeffs)
        
        # Convert to QUBO
        print(f"🔄 Converting {n} assets to QUBO with {bits_per_asset}-bit encoding (state space: {2**(n*bits_per_asset)} states)", file=sys.stderr)
        converter = QuadraticProgramToQubo()
        qubo = converter.convert(qp)
        
        # Setup QAOA with optimized parameters for 2-bit encoding
        print(f"⚙️ Initializing QAOA (reps=1, optimizer=SLSQP with maxiter=8)...", file=sys.stderr)
        sampler = Sampler()
        # Aggressive speed optimization: reduce iterations for faster completion
        qaoa = QAOA(sampler=sampler, optimizer=SLSQP(maxiter=8), reps=1)
        
        # Run optimization
        print(f"🚀 Running QAOA optimization...", file=sys.stderr)
        optimizer = MinimumEigenOptimizer(qaoa)
        result = optimizer.solve(qubo)
        print(f"✅ QAOA optimization completed", file=sys.stderr)
        
        # Extract weights from result
        weights = np.zeros(n)
        for i in range(n):
            for bit in range(bits_per_asset):
                var_name = f'x_{i}_{bit}'
                if var_name in result.variables_dict:
                    if result.variables_dict[var_name] > 0.5:
                        weights[i] += 2**bit / max_weight_value
        
        # Normalize weights
        if weights.sum() > 0:
            weights = weights / weights.sum()
        else:
            weights = np.ones(n) / n
        
        elapsed = time.time() - start_time
        print(f"✅ QAOA completed in {elapsed:.2f} seconds", file=sys.stderr)
        
        return weights
        
    except Exception as e:
        print(f"❌ QAOA optimization failed: {e}", file=sys.stderr)
        print("Falling back to MPT", file=sys.stderr)
        return optimize_with_modern_portfolio_theory(n, returns, covariance_matrix, risk_factor)


def optimize_hybrid_qaoa_mpt(n, returns, covariance_matrix, risk_factor):
    """
    Hybrid Quantum-Classical Portfolio Optimization
    
    Phase 1: QAOA for global exploration (quantum advantage)
    Phase 2: MPT refinement for precision (classical stability)
    
    This approach combines the best of both worlds:
    - QAOA: Explores the solution space efficiently using quantum computing
    - MPT: Refines the solution for optimal precision
    
    Args:
        n: Number of assets
        returns: Expected returns array
        covariance_matrix: Covariance matrix
        risk_factor: Risk tolerance (0-1)
        
    Returns:
        Optimized portfolio weights
    """
    try:
        print("🚀 Starting Hybrid QAOA+MPT optimization...", file=sys.stderr)
        total_start = time.time()
        
        # Phase 1: QAOA Exploration
        print("🔷 Phase 1: QAOA exploration...", file=sys.stderr)
        qaoa_start = time.time()
        qaoa_weights = optimize_with_qaoa(n, returns, covariance_matrix, risk_factor)
        qaoa_time = time.time() - qaoa_start
        print(f"   QAOA phase: {qaoa_time:.2f}s", file=sys.stderr)
        
        # Phase 2: MPT Refinement
        print("🔶 Phase 2: MPT refinement...", file=sys.stderr)
        mpt_start = time.time()
        
        # Use QAOA result as initial guess for MPT
        from scipy.optimize import minimize
        
        def portfolio_objective(w):
            portfolio_return = np.dot(w, returns)
            portfolio_risk = np.sqrt(np.dot(w.T, np.dot(covariance_matrix, w)))
            # Minimize risk while considering returns
            return risk_factor * portfolio_risk - (1 - risk_factor) * portfolio_return
        
        # Constraints: weights sum to 1
        constraints = {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}
        
        # Bounds: weights between 0 and 1
        bounds = tuple((0, 1) for _ in range(n))
        
        # Optimize using QAOA weights as starting point
        result = minimize(
            portfolio_objective,
            x0=qaoa_weights,  # Use QAOA result as initial guess
            method='SLSQP',
            bounds=bounds,
            constraints=constraints,
            options={'maxiter': 100, 'ftol': 1e-9}
        )
        
        mpt_time = time.time() - mpt_start
        print(f"   MPT phase: {mpt_time:.2f}s", file=sys.stderr)
        
        final_weights = result.x if result.success else qaoa_weights
        
        # Aggressive diversification enforcement: if single stock > 50%, redistribute
        max_weight_idx = np.argmax(final_weights)
        max_weight = final_weights[max_weight_idx]
        
        if max_weight > 0.50:
            print(f"⚠️ Single stock concentration detected ({max_weight:.1%}), enforcing diversification...", file=sys.stderr)
            # Cap maximum at 35% and redistribute remainder
            excess = max_weight - 0.35
            final_weights[max_weight_idx] = 0.35
            
            # Distribute excess to other stocks proportionally
            other_weights = final_weights.copy()
            other_weights[max_weight_idx] = 0
            other_sum = np.sum(other_weights)
            
            if other_sum > 0:
                for i in range(n):
                    if i != max_weight_idx:
                        final_weights[i] += excess * (other_weights[i] / other_sum)
            else:
                # Equal distribution if all others are zero
                for i in range(n):
                    if i != max_weight_idx:
                        final_weights[i] = excess / (n - 1)
            
            # Renormalize to ensure sum=1
            final_weights /= np.sum(final_weights)
            print(f"   Redistributed to {np.sum(final_weights > 0.01)} stocks", file=sys.stderr)
        
        # If only 1-2 stocks have weight, redistribute among QAOA-selected stocks
        active_stocks = np.sum(final_weights > 0.05)
        if active_stocks <= 2 and n >= 3:
            print(f"⚠️ Only {active_stocks} stocks active, redistributing among selected stocks...", file=sys.stderr)
            # Find which stocks QAOA selected (even with small weights)
            selected_stocks = final_weights > 0.001
            num_selected = np.sum(selected_stocks)
            
            if num_selected >= 3:
                # Redistribute equally among QAOA-selected stocks
                new_weights = np.zeros(n)
                new_weights[selected_stocks] = 1.0 / num_selected
                final_weights = new_weights
                print(f"   Equal distribution among {num_selected} QAOA-selected stocks ({100/num_selected:.1f}% each)", file=sys.stderr)
            else:
                # If QAOA only selected 1-2, pick top 3-5 by return/risk ratio
                num_to_select = min(5, n)
                sharpe = returns / (np.sqrt(np.diag(covariance_matrix)) + 1e-8)
                top_indices = np.argsort(sharpe)[-num_to_select:]
                new_weights = np.zeros(n)
                new_weights[top_indices] = 1.0 / num_to_select
                final_weights = new_weights
                print(f"   Equal distribution among top {num_to_select} stocks by Sharpe ratio ({100/num_to_select:.1f}% each)", file=sys.stderr)
        
        total_time = time.time() - total_start
        print(f"✅ Hybrid optimization completed in {total_time:.2f}s (QAOA: {qaoa_time:.2f}s + MPT: {mpt_time:.2f}s)", file=sys.stderr)
        
        return final_weights
        
    except Exception as e:
        print(f"❌ Hybrid optimization failed: {e}", file=sys.stderr)
        print("Falling back to pure MPT", file=sys.stderr)
        return optimize_with_modern_portfolio_theory(n, returns, covariance_matrix, risk_factor)

def main():
    if len(sys.argv) < 3:
        print("Usage: optimize_portfolio.py <input_json_file> <session_id> [method] [use_real_data]", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    session_id = sys.argv[2]
    method = sys.argv[3].upper() if len(sys.argv) > 3 else 'HYBRID'  # Default to HYBRID
    use_real_data = sys.argv[4].lower() == 'true' if len(sys.argv) > 4 else True
    

    try:
        # Load input data
        request_data = load_input_data(input_file)
        stocks = request_data['stocks']
        total_investment = request_data.get('totalInvestment', 10000)
        target_risk = request_data.get('targetRiskLevel', 5)
        use_real_data_from_request = request_data.get('useRealData', use_real_data)

        # 실시간 환율 fetch 및 적용
        exchange_rate = fetch_realtime_exchange_rate(base='USD', target='KRW', fallback=1350)
        print(f"적용 환율: USD/KRW={exchange_rate}", file=sys.stderr)

        # 모든 종목의 currentPrice, totalInvestment에 환율 적용 (USD → KRW)
        for stock in stocks:
            # currentPrice가 None이 아닌지 확인하고 float으로 변환
            if stock.get('currentPrice') is not None:
                stock['currentPrice'] = float(stock['currentPrice']) * exchange_rate
            
            # investmentAmount가 None이 아닌지 확인하고 float으로 변환
            if stock.get('investmentAmount') is not None:
                stock['investmentAmount'] = float(stock['investmentAmount']) * exchange_rate
        
        total_investment = float(total_investment or 0) * exchange_rate

        # Parse constraints if provided
        constraints = None
        if 'constraints' in request_data:
            constraints_data = request_data['constraints']
            min_weights = np.array([constraints_data.get(stock['symbol'], {}).get('min', 0.0) for stock in stocks])
            max_weights = np.array([constraints_data.get(stock['symbol'], {}).get('max', 1.0) for stock in stocks])
            constraints = {
                'min_weights': min_weights,
                'max_weights': max_weights
            }
            print(f"Using constraints: min={min_weights}, max={max_weights}", file=sys.stderr)
        
        # Prepare constraints for QAOA integer optimization (2-bit)
        prices = np.array([stock.get('currentPrice', 100.0) for stock in stocks])
        n_stocks = len(stocks)
        constraints_for_qaoa = {
            'prices': prices,
            'budget': total_investment,
            'min_shares': np.zeros(n_stocks, dtype=int),
            'max_shares': np.full(n_stocks, 3, dtype=int)  # Max 3 shares: (3+1)^6 = 4096 states (manageable memory)
        }
        print(f"QAOA constraints: budget={total_investment:.2f}, max_shares=3, prices={prices}", file=sys.stderr)

        # Fetch historical data and calculate statistics
        returns, covariance_matrix = fetch_historical_data(stocks, use_real_data=use_real_data_from_request)

        # Build optimization problem
        risk_factor = target_risk / 10.0  # Normalize to [0, 1]
        n, returns, covariance_matrix, risk_factor = build_portfolio_optimization_problem(
            returns, covariance_matrix, risk_factor
        )

        # Use Hybrid QAOA+MPT optimization
        print(f"Using optimization method: {method}", file=sys.stderr)
        
        if method == 'QAOA':
            weights = optimize_with_qaoa(n, returns, covariance_matrix, risk_factor, constraints_for_qaoa)
            method_name = 'QAOA 2-bit + MPT (Quantum Integer Optimization + Classical Refinement)'
        elif method == 'MPT':
            weights = optimize_with_modern_portfolio_theory(n, returns, covariance_matrix, risk_factor)
            method_name = 'MPT (Modern Portfolio Theory)'
        else:  # Default: HYBRID -> use 2-bit QAOA + MPT with constraints for speed
            weights = optimize_with_qaoa(n, returns, covariance_matrix, risk_factor, constraints_for_qaoa)
            method_name = 'Hybrid QAOA+MPT (Quantum Integer Optimization + Classical Refinement)'

        # Calculate allocations
        allocations = calculate_allocations(stocks, weights)
        share_allocations = calculate_share_allocations(stocks, weights)

        # Calculate portfolio metrics
        metrics = calculate_portfolio_metrics(returns, covariance_matrix, weights)

        # Calculate current portfolio weights
        # Support both quantity/currentPrice and investmentAmount formats
        if 'quantity' in stocks[0] and 'currentPrice' in stocks[0]:
            total_current_value = sum(stock['quantity'] * stock['currentPrice'] for stock in stocks)
            current_weights = np.array([
                (stock['quantity'] * stock['currentPrice']) / total_current_value 
                if total_current_value > 0 else 1.0 / len(stocks)
                for stock in stocks
            ])
        else:
            # Use investmentAmount
            total_investment_value = sum(stock.get('investmentAmount', 0) for stock in stocks)
            current_weights = np.array([
                stock.get('investmentAmount', 0) / total_investment_value
                if total_investment_value > 0 else 1.0 / len(stocks)
                for stock in stocks
            ])

        # Generate optimization reason
        optimization_reason = generate_optimization_reason(
            stocks, weights, returns, covariance_matrix, metrics, target_risk
        )

        # Generate recommendation reasons
        recommendation_reasons = generate_recommendation_reasons(
            stocks, weights, current_weights, returns, total_investment
        )

        # Generate efficient frontier
        efficient_frontier = generate_efficient_frontier(returns, covariance_matrix, num_portfolios=100)

        # Calculate current portfolio metrics
        current_metrics = calculate_portfolio_metrics(returns, covariance_matrix, current_weights)

        # Run backtesting if using real data (비활성화 - 속도 최적화)
        backtest_results = []
        # if use_real_data:
        #     print("Running backtesting...", file=sys.stderr)
        #     backtest_results = backtest_optimization(stocks, periods=['3mo', '6mo', '1y'])

        # Prepare result
        result = {
            'allocation': allocations,
            'shareAllocations': share_allocations,
            'expectedReturn': metrics['expectedReturn'],
            'expectedRisk': metrics['expectedRisk'],
            'sharpeRatio': metrics['sharpeRatio'],
            'optimizationReason': optimization_reason,
            'recommendationReasons': recommendation_reasons,
            'visualizationPath': f'/api/visualization/{session_id}',
            'efficientFrontier': efficient_frontier,
            'currentPortfolio': {
                'risk': current_metrics['expectedRisk'],
                'return': current_metrics['expectedReturn'],
                'sharpe': current_metrics['sharpeRatio']
            },
            'optimizedPortfolio': {
                'risk': metrics['expectedRisk'],
                'return': metrics['expectedReturn'],
                'sharpe': metrics['sharpeRatio']
            },
            'backtestResults': backtest_results,
            'additionalMetrics': {
                'optimizationMethod': method_name,
                'numberOfStocks': len(stocks),
                'totalInvestment': total_investment,
                'exchangeRate': exchange_rate,
                'timestamp': datetime.now().isoformat()
            }
        }

        # Output result as JSON
        print(json.dumps(result))

    except Exception as e:
        import traceback
        print(f"Error occurred: {str(e)}", file=sys.stderr)
        print(f"Traceback:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        error_result = {
            'error': str(e),
            'allocation': {},
            'expectedReturn': 0.0,
            'expectedRisk': 0.0,
            'sharpeRatio': 0.0,
            'visualizationPath': '',
            'additionalMetrics': {}
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()
