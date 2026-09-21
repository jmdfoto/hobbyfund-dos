import { useEffect, useState } from "react";
import { createInitialState, getBalances, addAllowance } from "./lib/ledger.js";
import { loadState, saveState } from "./lib/storage.js";
import Header from "./components/Header.jsx";
import BalanceCards from "./components/BalanceCards.jsx";
import ActionBar from "./components/ActionBar.jsx";
import SaveChart from "./components/SaveChart.jsx";
import InvestChart from "./components/InvestChart.jsx";
import History from "./components/History.jsx";
import AddAllowanceModal from "./components/modals/AddAllowanceModal.jsx";
import LogPurchaseModal from "./components/modals/LogPurchaseModal.jsx";
import MoveMoneyModal from "./components/modals/MoveMoneyModal.jsx";
import InvestModal from "./components/modals/InvestModal.jsx";
import { transactionsToCsv, downloadTextFile } from "./lib/csv.js";
import "./App.css";

function App() {
  const [state, setState] = useState(() => loadState(createInitialState()));
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const balances = getBalances(state.transactions);

  function closeModal() {
    setActiveModal(null);
  }

  function handleAllowanceConfirm({ spendAmount, saveAmount }) {
    const result = addAllowance(state.transactions, { spendAmount, saveAmount });
    if (result.ok) {
      setState((s) => ({ ...s, transactions: result.transactions }));
      closeModal();
    }
  }

  function handleTransactionsUpdate(transactions) {
    setState((s) => ({ ...s, transactions }));
    closeModal();
  }

  function handleNameChange(kidName) {
    setState((s) => ({ ...s, kidName }));
  }

  function handleExportCsv() {
    const csv = transactionsToCsv(state.transactions);
    const namePart = state.kidName.trim().toLowerCase().replace(/\s+/g, "-") || "collection-fund";
    const datePart = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `${namePart}-${datePart}.csv`, "text/csv");
  }

  function handleResetAll() {
    const confirmed = window.confirm(
      "Reset all data? This clears every transaction and can't be undone."
    );
    if (!confirmed) return;
    setState((s) => ({ ...s, transactions: [] }));
  }

  return (
    <div className="app">
      <Header kidName={state.kidName} onNameChange={handleNameChange} />

      <main className="app-main">
        <BalanceCards balances={balances} />
        <ActionBar onAction={setActiveModal} />
        <SaveChart transactions={state.transactions} />
        <InvestChart transactions={state.transactions} />
        <History transactions={state.transactions} />

        <div className="utility-links">
          <button type="button" className="reset-all-link" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button type="button" className="reset-all-link" onClick={handleResetAll}>
            Reset all data
          </button>
        </div>
      </main>

      {activeModal === "allowance" && (
        <AddAllowanceModal onConfirm={handleAllowanceConfirm} onClose={closeModal} />
      )}
      {activeModal === "purchase" && (
        <LogPurchaseModal
          transactions={state.transactions}
          onConfirm={handleTransactionsUpdate}
          onClose={closeModal}
        />
      )}
      {activeModal === "move" && (
        <MoveMoneyModal
          transactions={state.transactions}
          onConfirm={handleTransactionsUpdate}
          onClose={closeModal}
        />
      )}
      {activeModal === "invest" && (
        <InvestModal
          transactions={state.transactions}
          matchRatio={state.matchRatio}
          onConfirm={handleTransactionsUpdate}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default App;
