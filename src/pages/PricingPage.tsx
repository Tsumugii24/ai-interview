import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Check, Shield, Sparkles, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useUserStore } from '../store/userStore';
import { AI_REPORT_TOKEN_COST, SIMULATION_SESSION_TOKEN_COST, TOKEN_PACKS } from '../constants/billing';

type SubscriptionPlan = {
  id: string;
  tokens: number;
  price: string;
  title: string;
  description: string;
  features: string[];
  buttonText: string;
  disabled?: boolean;
  popular?: boolean;
  isCustom?: boolean;
};

type TokenPack = typeof TOKEN_PACKS[number];

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    tokens: 50,
    price: '0',
    title: 'Free',
    description: 'Basic interview simulation to get started.',
    features: ['50 tokens / month', 'Standard AI interviewer', 'Community support'],
    buttonText: 'Current Plan',
    disabled: true,
  },
  {
    id: 'plus',
    tokens: 500,
    price: '9',
    title: 'Plus',
    description: 'Enhanced practice for active job seekers.',
    features: ['500 tokens / month', 'Detailed interview feedback', 'Email support'],
    buttonText: 'Upgrade to Plus',
  },
  {
    id: 'pro',
    tokens: 2000,
    price: '29',
    title: 'Pro',
    description: 'The best fit for focused technical interview prep.',
    features: ['2000 tokens / month', 'Custom scenarios', 'Priority processing', 'Session analytics'],
    buttonText: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'enterprise',
    tokens: 0,
    price: 'Custom',
    title: 'Enterprise',
    description: 'Advanced access and custom deployment for teams.',
    features: ['Unlimited tokens', 'Custom AI personas', '24/7 support', 'SSO integration'],
    buttonText: 'Contact Sales',
    isCustom: true,
  },
];

const PLAN_RANKS: Record<string, number> = {
  Free: 1,
  Plus: 2,
  Pro: 3,
  Enterprise: 4,
};

export default function PricingPage() {
  const navigate = useNavigate();
  const token = useUserStore(state => state.token);
  const user = useUserStore(state => state.user);
  const updateBalance = useUserStore(state => state.updateBalance);
  const updatePlan = useUserStore(state => state.updatePlan);

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const currentRank = user?.plan ? PLAN_RANKS[user.plan] || 1 : 1;

  const handlePlanPurchase = async (plan: SubscriptionPlan) => {
    if (plan.isCustom) {
      navigate('/contact-sales');
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    if (plan.disabled) return;

    setLoadingKey(plan.id);
    setSuccessMsg('');

    try {
      const res = await fetch('/api/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: plan.tokens, planTitle: plan.title }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Subscription failed');

      updateBalance(data.balance);
      updatePlan(data.plan, data.nextRefresh);
      setSuccessMsg(`Switched to ${plan.title}. Your monthly token balance has been refreshed.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleTokenPackPurchase = async (pack: TokenPack) => {
    if (!token) {
      navigate('/login');
      return;
    }

    setLoadingKey(pack.id);
    setSuccessMsg('');

    try {
      const res = await fetch('/api/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: pack.tokens }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Token pack purchase failed');

      updateBalance(data.balance);
      setSuccessMsg(`${pack.tokens} extra tokens were added to your balance.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white selection:bg-indigo-500/30 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="max-w-[90rem] mx-auto px-6 py-16 lg:py-24 relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors mb-12"
        >
          <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mr-3 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800 transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back to Dashboard
        </button>

        <div className="text-center max-w-4xl mx-auto mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-bold tracking-tight mb-6"
          >
            Tokens Power The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Interview Flow</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-500 dark:text-zinc-400 leading-relaxed"
          >
            Monthly plans provide your standard quota. When that quota runs low, you can buy extra token packs without changing your subscription.
          </motion.p>
        </div>

        <div className="max-w-5xl mx-auto mb-10 rounded-3xl border border-indigo-200/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-indigo-500/20 dark:bg-zinc-900/85">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500 dark:text-indigo-300">Token Rules</div>
              <div className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                Joining a live simulation consumes <span className="font-bold text-zinc-900 dark:text-white">{SIMULATION_SESSION_TOKEN_COST}</span> tokens.
                Generating an AI evaluation report is optional and costs <span className="font-bold text-zinc-900 dark:text-white">{AI_REPORT_TOKEN_COST}</span> tokens after confirmation.
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/70">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Current Balance</div>
              <div className="mt-2 text-3xl font-black text-zinc-900 dark:text-white">{user?.balance ?? 0}</div>
            </div>
          </div>
        </div>

        {successMsg ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-12 bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Check size={20} />
            </div>
            <p className="text-emerald-300 font-medium">{successMsg}</p>
          </motion.div>
        ) : null}

        <section>
          <div className="mb-8">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Subscriptions</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Monthly plans with recurring token quotas</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {SUBSCRIPTION_PLANS.map((plan, idx) => {
              const planRank = PLAN_RANKS[plan.title] || 0;
              const isCurrentPlan = planRank === currentRank;
              const isLowerTier = planRank > 0 && planRank < currentRank;
              const isDisabled = (isCurrentPlan || isLowerTier) && !plan.isCustom;
              const loading = loadingKey === plan.id;

              let buttonText = plan.buttonText;
              if (isCurrentPlan) buttonText = 'Current Plan';
              if (isLowerTier && !plan.isCustom) buttonText = 'Included';

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className={`relative h-full flex flex-col rounded-3xl p-1 ${
                    plan.popular && !isDisabled
                      ? 'bg-gradient-to-b from-indigo-500 to-cyan-500 shadow-[0_0_40px_rgba(99,102,241,0.2)]'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
                  } ${isDisabled ? 'opacity-80' : ''}`}
                >
                  <div className={`h-full flex flex-col rounded-[22px] p-6 xl:p-8 ${plan.popular && !isDisabled ? 'bg-zinc-50 dark:bg-zinc-950/95 backdrop-blur-xl' : 'bg-zinc-50 dark:bg-zinc-950'}`}>
                    {plan.popular && !isDisabled ? (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white shadow-xl whitespace-nowrap">
                        Most Popular
                      </div>
                    ) : null}

                    <div className="mb-6">
                      <h3 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">{plan.title}</h3>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{plan.description}</p>
                    </div>

                    <div className="mb-8 flex items-baseline gap-2">
                      {plan.isCustom ? (
                        <span className="text-4xl font-bold tracking-tight">Custom</span>
                      ) : (
                        <>
                          <span className="text-5xl font-bold tracking-tight">${plan.price}</span>
                          <span className="text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">/ month</span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => handlePlanPurchase(plan)}
                      disabled={loading || isDisabled || plan.disabled}
                      className={`w-full py-4 rounded-xl font-semibold transition-all mb-8 flex items-center justify-center gap-2 ${
                        plan.popular && !isDisabled
                          ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                          : plan.isCustom
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700'
                            : isDisabled || plan.disabled
                              ? 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 cursor-not-allowed'
                              : 'bg-zinc-100 text-zinc-900 hover:bg-white dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800'
                      } ${loading ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : plan.isCustom ? (
                        <>
                          {buttonText}
                          <Building2 size={16} />
                        </>
                      ) : isCurrentPlan ? (
                        <>
                          <Check size={16} />
                          {buttonText}
                        </>
                      ) : (
                        buttonText
                      )}
                    </button>

                    <div className="space-y-4 flex-grow border-t border-zinc-200 dark:border-zinc-800/50 pt-8">
                      {plan.features.map(feature => (
                        <div key={feature} className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            plan.popular && !isDisabled
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : isDisabled
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                          <span className={`text-sm leading-snug ${isDisabled ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Token Packs</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">One-time top-ups for extra usage</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
              <Wallet size={16} />
              Keeps your current plan unchanged
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TOKEN_PACKS.map((pack, idx) => {
              const loading = loadingKey === pack.id;
              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold text-zinc-900 dark:text-white">{pack.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-400">{pack.description}</p>

                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-5xl font-black tracking-tight text-zinc-900 dark:text-white">{pack.tokens}</span>
                    <span className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">tokens</span>
                  </div>
                  <div className="mt-2 text-lg font-semibold text-emerald-600 dark:text-emerald-400">${pack.price} one-time</div>

                  <button
                    onClick={() => handleTokenPackPurchase(pack)}
                    disabled={loading}
                    className={`mt-8 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 ${loading ? 'opacity-75 cursor-wait' : ''}`}
                  >
                    {loading ? 'Processing...' : `Buy ${pack.tokens} Tokens`}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </section>

        <div className="max-w-5xl mx-auto mt-24 grid md:grid-cols-3 gap-8 text-center border-t border-zinc-200 dark:border-zinc-800/50 pt-16">
          <div className="flex flex-col items-center">
            <Shield className="text-zinc-500 dark:text-zinc-400 mb-4 w-8 h-8" />
            <h4 className="text-zinc-700 dark:text-zinc-300 font-medium mb-2">Secure Payments</h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-balance">All transactions are encrypted and processed securely by Stripe.</p>
          </div>
          <div className="flex flex-col items-center">
            <Sparkles className="text-zinc-500 dark:text-zinc-400 mb-4 w-8 h-8" />
            <h4 className="text-zinc-700 dark:text-zinc-300 font-medium mb-2">Instant Delivery</h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-balance">Monthly quotas and one-time token packs are applied to your balance immediately.</p>
          </div>
          <div className="flex flex-col items-center">
            <Wallet className="text-zinc-500 dark:text-zinc-400 mb-4 w-8 h-8" />
            <h4 className="text-zinc-700 dark:text-zinc-300 font-medium mb-2">Flexible Usage</h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-balance">Stay on your current plan and add more tokens only when your usage requires it.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
