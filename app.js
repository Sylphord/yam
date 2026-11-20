"use strict";

const STORAGE_KEY = "yam-work-items-v1";
const workList = document.querySelector("#work-list");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#quote-dialog");
const form = document.querySelector("#quote-form");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");
const dateInput = form.elements.dueDate;
let toastTimer;

const sampleItems = [
  { id: "YM-1042", customer: "Alex Morgan", job: "Bathroom tap replacement", amount: 185, dueDate: "2026-11-25", status: "awaiting", createdAt: "2026-11-15" },
  { id: "YM-1041", customer: "Olivia Reed", job: "Fence repair & new gate", amount: 420, dueDate: "2026-11-18", status: "awaiting", createdAt: "2026-11-12" },
  { id: "YM-1040", customer: "Sam Patel", job: "Kitchen splashback tiling", amount: 675, dueDate: "2026-11-28", status: "quote", createdAt: "2026-11-11" },
  { id: "YM-1039", customer: "Taylor Green", job: "Replace hallway light fittings", amount: 240, dueDate: "2026-11-08", status: "paid", createdAt: "2026-11-03" }
];

function loadItems() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return sampleItems;
    const items = JSON.parse(saved);
    if (!Array.isArray(items) || !items.every(isWorkItem)) {
      throw new Error("Saved work data has an unexpected format.");
    }
    return items;
  } catch (error) {
    console.error("Could not load saved work:", error);
    showToast("Couldn’t load saved work. Check browser storage settings.");
    return [];
  }
}

function isWorkItem(item) {
  return item !== null
    && typeof item === "object"
    && typeof item.id === "string"
    && typeof item.customer === "string"
    && typeof item.job === "string"
    && Number.isFinite(item.amount)
    && typeof item.dueDate === "string"
    && ["quote", "awaiting", "paid"].includes(item.status);
}

let items = loadItems();

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (error) {
    console.error("Could not save work:", error);
    showToast("Couldn’t save. Check browser storage settings and try again.");
    return false;
  }
}

function pounds(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2
  }).format(value);
}

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "No due date";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function isOverdue(item) {
  return item.status === "awaiting" && item.dueDate < localDate();
}

function statusDetails(item) {
  if (item.status === "quote") return { label: "Quote", className: "quote" };
  if (item.status === "paid") return { label: "Paid", className: "paid" };
  if (isOverdue(item)) return { label: "Overdue", className: "overdue" };
  return { label: "Awaiting payment", className: "awaiting" };
}

function renderSummary() {
  const awaiting = items.filter(item => item.status === "awaiting");
  const overdue = awaiting.filter(isOverdue);
  const monthPrefix = localDate().slice(0, 7);
  const paidThisMonth = items.filter(item => item.status === "paid" && item.paidAt?.startsWith(monthPrefix));

  document.querySelector("#awaiting-total").textContent = pounds(awaiting.reduce((sum, item) => sum + item.amount, 0));
  document.querySelector("#awaiting-count").textContent = awaiting.length;
  document.querySelector("#overdue-total").textContent = pounds(overdue.reduce((sum, item) => sum + item.amount, 0));
  document.querySelector("#overdue-count").textContent = overdue.length;
  document.querySelector("#paid-total").textContent = pounds(paidThisMonth.reduce((sum, item) => sum + item.amount, 0));
  document.querySelector("#paid-count").textContent = paidThisMonth.length;
}

function makeCell(className, text) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderRows() {
  const query = searchInput.value.trim().toLocaleLowerCase("en-GB");
  const filter = statusFilter.value;
  const visibleItems = items.filter(item => {
    const matchesText = `${item.customer} ${item.job} ${item.id}`.toLocaleLowerCase("en-GB").includes(query);
    const matchesFilter = filter === "all"
      || (filter === "quote" && item.status === "quote")
      || (filter === "awaiting" && item.status === "awaiting")
      || (filter === "paid" && item.status === "paid");
    return matchesText && matchesFilter;
  });

  workList.replaceChildren();
  emptyState.hidden = visibleItems.length > 0;
  workList.closest(".table-wrap").querySelector("table").hidden = visibleItems.length === 0;

  for (const item of visibleItems) {
    const row = document.createElement("tr");
    const customerCell = document.createElement("td");
    customerCell.className = "customer-cell";
    const customer = document.createElement("strong");
    customer.textContent = item.customer;
    const job = document.createElement("span");
    job.textContent = item.job;
    customerCell.append(customer, job);

    const status = statusDetails(item);
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status status-${status.className}`;
    badge.textContent = status.label;
    statusCell.append(badge);

    const actions = document.createElement("td");
    actions.className = "row-actions";
    if (item.status === "awaiting") {
      const paidButton = document.createElement("button");
      paidButton.type = "button";
      paidButton.className = "action-button";
      paidButton.dataset.action = "paid";
      paidButton.dataset.id = item.id;
      paidButton.textContent = "Mark paid";
      actions.append(paidButton);

      const reminder = document.createElement("button");
      reminder.type = "button";
      reminder.className = "action-button";
      reminder.dataset.action = "remind";
      reminder.dataset.id = item.id;
      reminder.textContent = "Reminder";
      actions.append(reminder);
    } else {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "action-button remove";
      removeButton.dataset.action = "delete";
      removeButton.dataset.id = item.id;
      removeButton.textContent = "Delete";
      actions.append(removeButton);
    }

    const amountCell = makeCell("amount-cell", pounds(item.amount));
    row.append(
      customerCell,
      makeCell("reference", item.id),
      makeCell("", formatDate(item.dueDate)),
      statusCell,
      amountCell,
      actions
    );
    workList.append(row);
  }
}

function render() {
  renderSummary();
  renderRows();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function nextReference() {
  const highest = items.reduce((max, item) => {
    const number = Number(item.id.match(/^YM-(\d+)$/)?.[1] || 0);
    return Math.max(max, number);
  }, 1038);
  return `YM-${highest + 1}`;
}

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", year: "numeric"
}).format(new Date());

for (const button of document.querySelectorAll("[data-open-form]")) {
  button.addEventListener("click", () => {
    form.reset();
    form.elements.dueDate.value = localDate();
    document.querySelector("#form-error").hidden = true;
    dialog.showModal();
    form.elements.customer.focus();
  });
}

document.querySelector(".close-dialog").addEventListener("click", () => dialog.close());
document.querySelector(".cancel-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

form.addEventListener("submit", event => {
  event.preventDefault();
  const formData = new FormData(form);
  const amount = Number(formData.get("amount"));
  const dueDate = String(formData.get("dueDate"));
  const error = document.querySelector("#form-error");

  if (!Number.isFinite(amount) || amount <= 0 || !dueDate) {
    error.textContent = "Enter a valid amount and due date.";
    error.hidden = false;
    return;
  }

  const newItem = {
    id: nextReference(),
    customer: String(formData.get("customer")).trim(),
    job: String(formData.get("job")).trim(),
    amount,
    dueDate,
    status: String(formData.get("status")),
    createdAt: localDate()
  };
  items = [newItem, ...items];
  if (!saveItems()) {
    items = items.filter(item => item.id !== newItem.id);
    return;
  }
  render();
  dialog.close();
  showToast("Quote saved.");
});

workList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = items.find(entry => entry.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "paid") {
    const previous = { status: item.status, paidAt: item.paidAt };
    item.status = "paid";
    item.paidAt = localDate();
    if (!saveItems()) {
      item.status = previous.status;
      item.paidAt = previous.paidAt;
      return;
    }
    render();
    showToast("Payment marked as received.");
  } else if (button.dataset.action === "remind") {
    const subject = encodeURIComponent(`Payment reminder for ${item.id}`);
    const body = encodeURIComponent(
      `Hi ${item.customer},\n\nJust a friendly reminder that payment of ${pounds(item.amount)} for ${item.job} is due ${formatDate(item.dueDate)}.\n\nThanks!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  } else if (button.dataset.action === "delete") {
    if (!window.confirm(`Delete the record for ${item.customer} — ${item.job}?`)) return;
    const previousItems = items;
    items = items.filter(entry => entry.id !== item.id);
    if (!saveItems()) {
      items = previousItems;
      return;
    }
    render();
    showToast("Record deleted.");
  }
});

searchInput.addEventListener("input", renderRows);
statusFilter.addEventListener("change", renderRows);
render();
