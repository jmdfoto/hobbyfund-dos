import { useEffect, useRef, useState } from "react";
import {
  createInitialState,
  getBalances,
  addAllowance,
  logPurchase,
  moveMoney,
  invest,
} from "./lib/ledger.js";
import { loadState, saveState } from "./lib/storage.js";
import { connect, send, fetchInvest, placeOrder, newRequestId, signOut } from "./lib/api.js";
import Header from "./components/Header.jsx";
import BalanceCards from "./components/BalanceCards.jsx";
import ActionBar from "./components/ActionBar.jsx";
import SaveChart from "./components/SaveChart.jsx";
import InvestChart from "./components/InvestChart.jsx";
import History from "./components/History.jsx";
import Holdings from "./components/Holdings.jsx";
import Orders from "./components/Orders.jsx";
import AddAllowanceModal from "./components/modals/AddAllowanceModal.jsx";
import LogPurchaseModal from "./components/modals/LogPurchaseModal.jsx";
import MoveMoneyModal from "./components/modals/MoveMoneyModal.jsx";
import InvestModal from "./components/modals/InvestModal.jsx";
import RecordDepositModal from "./components/modals/RecordDepositModal.jsx";
import TradeModal from "./components/modals/TradeModal.jsx";
import { transactionsToCsv, downloadTextFile } from "./lib/csv.js";
import "./App.css";

// Same validation the server runs; checking first gives instant errors without a round trip.
function applyLocally(transactions, action, matchRatio) {
  switch (action.type) {
    case "allowance":
      return addAllowance(transactions, action);
    case "purchase":
      return logPurchase(transactions, action);
    case "move":
      return moveMoney(transactions, action);
    case "invest":
      return invest(transactions, { ...action, matchRatio });
    default:
      return { ok: false, error: "Unknown action." };
  }
}

function StatusScreen({ message, buttonLabel, onButton }) {
  return (
    <div className="app">
      <main className="app-main status-screen">
        <p className="empty-state">{message}</p>
        {buttonLabel && (
          <button type="button" className="btn btn-primary" onClick={onButton}>
            {buttonLabel}
          </button>
        )}
      </main>
    </div>
  );
}

function App() {
  // "loading" | "local" (no backend: localStorage, as before) | "server" | "signin" | "forbidden" | "error"
  const [mode, setMode] = useState("loading");
  const [connectError, setConnectError] = useState("");
  const [role, setRole] = useState("parent");
  const [state, setState] = useState(createInitialState);
  const [activeModal, setActiveModal] = useState(null);
  // Brokerage-backed Invest numbers (server mode only); null until loaded or when unavailable.
  const [invest, setInvest] = useState(null);
  const requestIdRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    connect().then((result) => {
      if (cancelled) return;
      if (result.mode === "server") {
        setRole(result.state.role);
        setState(result.state);
        fetchInvest().then((r) => {
          if (!cancelled && r.ok) setInvest(r.invest);
        });
      } else if (result.mode === "local") {
        setState(loadState(createInitialState()));
      } else {
        setConnectError(result.error ?? "");
      }
      setMode(result.mode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode === "local") saveState(state);
  }, [mode, state]);

  const isParent = mode === "local" || role === "parent";
  const balances = getBalances(state.transactions);

  function openModal(name) {
    // One id per opened form: a double-submit or retry of the same form is applied only once.
    requestIdRef.current = newRequestId();
    setActiveModal(name);
  }

  function closeModal() {
    setActiveModal(null);
  }

  function applyServerState(serverState) {
    setRole(serverState.role);
    setState(serverState);
    // Pending allocation depends on the ledger, so re-read the Invest numbers too.
    refreshInvest();
  }

  async function refreshInvest() {
    const result = await fetchInvest();
    if (result.ok) setInvest(result.invest);
  }

  // The order id is created when the dialog opens, so retrying the same dialog can never place
  // a second order.
  async function handleTradeConfirm(order) {
    const result = await placeOrder({ requestId: requestIdRef.current, ...order });
    if (result.ok) refreshInvest();
    return result;
  }

  async function handleDepositConfirm({ amount, note }) {
    const result = await send("POST", "/api/deposits", {
      requestId: requestIdRef.current,
      amount,
      note,
    });
    if (!result.ok) return result;
    applyServerState(result.state);
    closeModal();
    return { ok: true };
  }

  // Resolves to { ok, error } so the modal can show server-side errors.
  async function performAction(action) {
    const local = applyLocally(state.transactions, action, state.matchRatio);
    if (!local.ok) return local;

    if (mode === "local") {
      setState((s) => ({ ...s, transactions: local.transactions }));
      closeModal();
      return { ok: true };
    }

    const result = await send("POST", "/api/actions", {
      requestId: requestIdRef.current,
      action,
    });
    if (!result.ok) return result;
    applyServerState(result.state);
    closeModal();
    return { ok: true };
  }

  async function handleNameChange(kidName) {
    const previous = state.kidName;
    setState((s) => ({ ...s, kidName }));
    if (mode !== "server") return;
    const result = await send("PUT", "/api/settings", { kidName });
    if (result.ok) applyServerState(result.state);
    else setState((s) => ({ ...s, kidName: previous }));
  }

  async function handleMatchChange(matchRatio) {
    const previous = state.matchRatio;
    setState((s) => ({ ...s, matchRatio }));
    if (mode !== "server") return { ok: true };
    const result = await send("PUT", "/api/settings", { matchRatio });
    if (result.ok) applyServerState(result.state);
    else setState((s) => ({ ...s, matchRatio: previous }));
    return result;
  }

  function handleExportCsv() {
    const csv = transactionsToCsv(state.transactions);
    const namePart = state.kidName.trim().toLowerCase().replace(/\s+/g, "-") || "collection-fund";
    const datePart = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `${namePart}-${datePart}.csv`, "text/csv");
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const csv = await file.text();
    const confirmed = window.confirm(`Import transactions from "${file.name}"?`);
    if (!confirmed) return;
    const result = await send("POST", "/api/import", { requestId: newRequestId(), csv });
    if (result.ok) applyServerState(result.state);
    else window.alert(`Import failed: ${result.error}`);
  }

  async function handleResetAll() {
    const confirmed = window.confirm(
      "Reset all data? This clears every transaction and can't be undone."
    );
    if (!confirmed) return;
    if (mode === "local") {
      setState((s) => ({ ...s, transactions: [] }));
      return;
    }
    const result = await send("POST", "/api/reset", { requestId: newRequestId() });
    if (result.ok) applyServerState(result.state);
    else window.alert(`Reset failed: ${result.error}`);
  }

  if (mode === "loading") return <StatusScreen message="Loading…" />;
  if (mode === "signin") {
    return (
      <StatusScreen
        message="Please sign in to continue."
        buttonLabel="Sign in"
        onButton={() => window.location.reload()}
      />
    );
  }
  if (mode === "forbidden") {
    return <StatusScreen message={connectError} buttonLabel="Sign out" onButton={signOut} />;
  }
  if (mode === "error") {
    return (
      <StatusScreen
        message={connectError}
        buttonLabel="Try again"
        onButton={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="app">
      <Header kidName={state.kidName} onNameChange={handleNameChange} editable={isParent} />

      <main className="app-main">
        <BalanceCards balances={balances} invest={invest} />
        {isParent && <ActionBar onAction={openModal} />}
        <SaveChart transactions={state.transactions} />
        <InvestChart transactions={state.transactions} invest={invest} />
        <Holdings
          invest={invest}
          canRecordDeposit={isParent}
          onRecordDeposit={() => openModal("deposit")}
          canTrade={isParent}
          onTrade={() => openModal("trade")}
        />
        {invest?.connected && <Orders refreshKey={invest} />}
        <History transactions={state.transactions} />

        <div className="utility-links">
          {isParent && (
            <button type="button" className="reset-all-link" onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          {isParent && mode === "server" && state.transactions.length === 0 && (
            <>
              <button
                type="button"
                className="reset-all-link"
                onClick={() => importInputRef.current?.click()}
              >
                Import CSV
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={handleImportFile}
              />
            </>
          )}
          {isParent && (
            <button type="button" className="reset-all-link" onClick={handleResetAll}>
              Reset all data
            </button>
          )}
          {mode === "server" && (
            <button type="button" className="reset-all-link" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </main>

      {activeModal === "allowance" && (
        <AddAllowanceModal onConfirm={performAction} onClose={closeModal} />
      )}
      {activeModal === "purchase" && (
        <LogPurchaseModal onConfirm={performAction} onClose={closeModal} />
      )}
      {activeModal === "move" && (
        <MoveMoneyModal
          transactions={state.transactions}
          onConfirm={performAction}
          onClose={closeModal}
        />
      )}
      {activeModal === "deposit" && invest && (
        <RecordDepositModal
          pending={invest.pending}
          onConfirm={handleDepositConfirm}
          onClose={closeModal}
        />
      )}
      {activeModal === "trade" && invest && (
        <TradeModal
          holdings={invest.holdings}
          limits={invest.limits}
          onConfirm={handleTradeConfirm}
          onClose={closeModal}
        />
      )}
      {activeModal === "invest" && (
        <InvestModal
          transactions={state.transactions}
          matchRatio={state.matchRatio}
          onMatchChange={handleMatchChange}
          onConfirm={performAction}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default App;
