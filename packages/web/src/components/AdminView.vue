<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiButton from "./UiButton.vue";
import UiPanel from "./UiPanel.vue";

const ADMIN_TOKEN_KEY = "affordance-atlas-admin-token";

type AdminSummary = {
  generated_at: string;
  status_counts: { status: string; count: number }[];
  recent_jobs: {
    research_job_id: string;
    original_user_query: string;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  }[];
};

type AdminTable = {
  name: string;
  label: string;
  count: number;
};

type AdminTableRows = {
  table: AdminTable;
  limit: number;
  offset: number;
  rows: Record<string, unknown>[];
};

export type AdminVisualFixture = {
  authenticated?: boolean;
  loading?: boolean;
  error?: string | null;
  copyMessage?: string | null;
  tokenInput?: string;
  savedToken?: string;
  summary?: AdminSummary | null;
  tables?: AdminTable[];
  selectedTable?: string;
  tableRows?: AdminTableRows | null;
  tableLoading?: boolean;
  tableOffset?: number;
  tableFilter?: string;
  tableSortColumn?: string | null;
  tableSortDirection?: "asc" | "desc";
  selectedRow?: Record<string, unknown> | null;
  selectedRowJson?: string | null;
  rowCopyMessage?: string | null;
};

const adminTokenInput = ref("");
const savedAdminToken = ref("");
const adminTokenInputVisible = ref(false);
const savedAdminTokenVisible = ref(false);
const adminAuthenticated = ref(false);
const adminLoading = ref(false);
const adminError = ref<string | null>(null);
const adminCopyMessage = ref<string | null>(null);
const adminSummary = ref<AdminSummary | null>(null);
const adminTables = ref<AdminTable[]>([]);
const selectedAdminTable = ref<string>("research_job");
const adminTableRows = ref<AdminTableRows | null>(null);
const adminTableLoading = ref(false);
const adminTableOffset = ref(0);
const adminTableLimit = 25;
const adminTableFilter = ref("");
const adminTableSortColumn = ref<string | null>(null);
const adminTableSortDirection = ref<"asc" | "desc">("asc");
const adminSelectedRow = ref<Record<string, unknown> | null>(null);
const adminRowCopyMessage = ref<string | null>(null);

const selectedAdminColumns = computed(() => {
  const rows = adminTableRows.value?.rows ?? [];
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
});

const filteredAdminRows = computed(() => {
  const rows = adminTableRows.value?.rows ?? [];
  const filter = adminTableFilter.value.trim().toLowerCase();
  if (!filter) return rows;
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(filter));
});

const sortedAdminRows = computed(() => {
  const rows = [...filteredAdminRows.value];
  const column = adminTableSortColumn.value;
  if (!column) return rows;

  const direction = adminTableSortDirection.value === "asc" ? 1 : -1;
  return rows.sort((left, right) => {
    const leftString = formatSortValue(left[column]);
    const rightString = formatSortValue(right[column]);
    return leftString.localeCompare(rightString, undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
});

const selectedAdminRowJson = computed(() => adminSelectedRow.value ? JSON.stringify(adminSelectedRow.value, null, 2) : "");

const canPageAdminBack = computed(() => adminTableOffset.value > 0);
const canPageAdminForward = computed(() => {
  const table = adminTableRows.value?.table;
  return table ? adminTableOffset.value + adminTableLimit < table.count : false;
});
const displayedSavedAdminToken = computed(() => {
  if (!savedAdminToken.value) return "";
  if (savedAdminTokenVisible.value) return savedAdminToken.value;
  return "*".repeat(Math.min(savedAdminToken.value.length, 24));
});

function adminHeaders(token = savedAdminToken.value): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const jsonValue = JSON.stringify(value);
  return jsonValue.length > 240 ? `${jsonValue.slice(0, 240)}...` : jsonValue;
}

function formatSortValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function loadAdminSummary(): Promise<void> {
  const response = await fetch("/api/admin/summary", { headers: adminHeaders() });
  const data = await response.json() as AdminSummary & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Unable to load admin summary.");
  adminSummary.value = data;
}

async function loadAdminTables(): Promise<void> {
  const response = await fetch("/api/admin/tables", { headers: adminHeaders() });
  const data = await response.json() as { tables?: AdminTable[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Unable to load admin tables.");
  adminTables.value = data.tables ?? [];
  if (!adminTables.value.some((table) => table.name === selectedAdminTable.value)) {
    selectedAdminTable.value = adminTables.value[0]?.name ?? "research_job";
  }
}

async function loadAdminTableRows(tableName = selectedAdminTable.value, offset = adminTableOffset.value): Promise<void> {
  if (!tableName) return;
  adminTableLoading.value = true;
  adminError.value = null;
  try {
    const params = new URLSearchParams({ limit: String(adminTableLimit), offset: String(offset) });
    const response = await fetch(`/api/admin/tables/${encodeURIComponent(tableName)}?${params}`, { headers: adminHeaders() });
    const data = await response.json() as AdminTableRows & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load table rows.");
    selectedAdminTable.value = tableName;
    adminTableOffset.value = offset;
    adminTableRows.value = data;
    adminSelectedRow.value = null;
    adminRowCopyMessage.value = null;
  } finally {
    adminTableLoading.value = false;
  }
}

function resetAdminTableTools(): void {
  adminTableFilter.value = "";
  adminTableSortColumn.value = null;
  adminTableSortDirection.value = "asc";
  adminSelectedRow.value = null;
  adminRowCopyMessage.value = null;
}

async function selectAdminTable(tableName: string): Promise<void> {
  if (tableName !== selectedAdminTable.value) resetAdminTableTools();
  await loadAdminTableRows(tableName, 0);
}

async function pageAdminTable(direction: "previous" | "next"): Promise<void> {
  const delta = direction === "next" ? adminTableLimit : -adminTableLimit;
  await loadAdminTableRows(selectedAdminTable.value, Math.max(0, adminTableOffset.value + delta));
}

function toggleAdminTableSort(column: string): void {
  if (adminTableSortColumn.value === column) {
    adminTableSortDirection.value = adminTableSortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  adminTableSortColumn.value = column;
  adminTableSortDirection.value = "asc";
}

function selectAdminRow(row: Record<string, unknown>): void {
  adminSelectedRow.value = row;
  adminRowCopyMessage.value = null;
}

async function copyAdminRowJson(): Promise<void> {
  if (!selectedAdminRowJson.value) return;
  await navigator.clipboard.writeText(selectedAdminRowJson.value);
  adminRowCopyMessage.value = "Row JSON copied.";
}

function clearAdminTableFilters(): void {
  resetAdminTableTools();
}

async function validateAdminToken(token = adminTokenInput.value.trim()): Promise<void> {
  if (!token) return;
  adminLoading.value = true;
  adminError.value = null;
  adminCopyMessage.value = null;
  try {
    const response = await fetch("/api/admin/session", { headers: adminHeaders(token) });
    const data = await response.json() as { authenticated?: boolean; error?: string };
    if (!response.ok || !data.authenticated) throw new Error(data.error ?? "Invalid admin bearer token.");
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    savedAdminToken.value = token;
    adminTokenInput.value = token;
    savedAdminTokenVisible.value = false;
    adminTokenInputVisible.value = false;
    adminAuthenticated.value = true;
    await Promise.all([loadAdminSummary(), loadAdminTables()]);
    await loadAdminTableRows(selectedAdminTable.value, 0);
  } catch (err) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    savedAdminToken.value = "";
    savedAdminTokenVisible.value = false;
    adminAuthenticated.value = false;
    adminSummary.value = null;
    adminTables.value = [];
    adminTableRows.value = null;
    adminError.value = err instanceof Error ? err.message : String(err);
  } finally {
    adminLoading.value = false;
  }
}

async function copyAdminToken(kind: "raw" | "bearer"): Promise<void> {
  if (!savedAdminToken.value) return;
  const value = kind === "bearer" ? `Authorization: Bearer ${savedAdminToken.value}` : savedAdminToken.value;
  await navigator.clipboard.writeText(value);
  adminCopyMessage.value = kind === "bearer" ? "Authorization header copied." : "Token copied.";
}

function clearAdminToken(): void {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  savedAdminToken.value = "";
  adminTokenInput.value = "";
  savedAdminTokenVisible.value = false;
  adminTokenInputVisible.value = false;
  adminAuthenticated.value = false;
  adminSummary.value = null;
  adminTables.value = [];
  adminTableRows.value = null;
  adminError.value = null;
  adminCopyMessage.value = null;
  resetAdminTableTools();
}

function applyAdminVisualFixture(admin: AdminVisualFixture): void {
  if (admin.authenticated !== undefined) adminAuthenticated.value = admin.authenticated;
  if (admin.loading !== undefined) adminLoading.value = admin.loading;
  if (admin.error !== undefined) adminError.value = admin.error;
  if (admin.copyMessage !== undefined) adminCopyMessage.value = admin.copyMessage;
  if (admin.tokenInput !== undefined) adminTokenInput.value = admin.tokenInput;
  if (admin.savedToken !== undefined) savedAdminToken.value = admin.savedToken;
  if (admin.summary !== undefined) adminSummary.value = admin.summary;
  if (admin.tables !== undefined) adminTables.value = admin.tables;
  if (admin.selectedTable !== undefined) selectedAdminTable.value = admin.selectedTable;
  if (admin.tableRows !== undefined) adminTableRows.value = admin.tableRows;
  if (admin.tableLoading !== undefined) adminTableLoading.value = admin.tableLoading;
  if (admin.tableOffset !== undefined) adminTableOffset.value = admin.tableOffset;
  if (admin.tableFilter !== undefined) adminTableFilter.value = admin.tableFilter;
  if (admin.tableSortColumn !== undefined) adminTableSortColumn.value = admin.tableSortColumn;
  if (admin.tableSortDirection !== undefined) adminTableSortDirection.value = admin.tableSortDirection;
  if (admin.selectedRow !== undefined) adminSelectedRow.value = admin.selectedRow;
  if (admin.selectedRowJson !== undefined) {
    try {
      adminSelectedRow.value = admin.selectedRowJson ? JSON.parse(admin.selectedRowJson) as Record<string, unknown> : null;
    } catch {
      adminSelectedRow.value = null;
    }
  }
  if (admin.rowCopyMessage !== undefined) adminRowCopyMessage.value = admin.rowCopyMessage;
}

onMounted(() => {
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  adminTokenInput.value = token;
  savedAdminToken.value = token;
  if (token) void validateAdminToken(token);
});

defineExpose({ applyAdminVisualFixture });
</script>

<template>
  <section :class="['mx-auto', adminAuthenticated ? 'max-w-[1280px]' : 'max-w-[720px]']" aria-label="Admin">
    <UiPanel>
      <div class="grid gap-1">
        <h2 class="m-0">Admin</h2>
        <p class="muted text-sm text-muted">{{ adminAuthenticated ? "Operational status and table data for the current worker." : "Enter the admin bearer token to unlock operational status." }}</p>
      </div>

      <form v-if="!adminAuthenticated" class="mt-4 grid gap-2" @submit.prevent="validateAdminToken()">
        <div class="flex items-center justify-between gap-2">
          <label for="admin-token" class="text-xs font-semibold text-text-subtle">Bearer token</label>
          <button
            type="button"
            class="rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-text hover:bg-surface-muted"
            :aria-pressed="adminTokenInputVisible"
            aria-controls="admin-token"
            @click="adminTokenInputVisible = !adminTokenInputVisible"
          >
            {{ adminTokenInputVisible ? "Hide token" : "Show token" }}
          </button>
        </div>
        <div class="grid gap-1">
          <input
            id="admin-token"
            v-model="adminTokenInput"
            data-testid="admin-token-input"
            :type="adminTokenInputVisible ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Paste admin bearer token"
            class="rounded-md border border-border-strong p-3"
          />
          <p class="m-0 text-xs text-muted">Verified tokens are saved in this browser only. Keep this device and clipboard trusted.</p>
        </div>
        <UiButton data-testid="admin-token-submit" variant="primary" type="submit" :disabled="adminLoading || adminTokenInput.trim().length === 0">
          {{ adminLoading ? "Verifying..." : "Unlock admin" }}
        </UiButton>
      </form>

      <div v-else>
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div class="grid min-w-0 gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="m-0 text-xs font-semibold text-text-subtle">Saved bearer token</p>
              <span class="rounded-md border border-border bg-surface-subtle px-2 py-0.5 text-xs text-muted">Local browser storage</span>
            </div>
            <code data-testid="admin-token-mask" class="block max-w-full overflow-x-auto text-text">{{ displayedSavedAdminToken }}</code>
            <p class="m-0 text-xs text-muted">Saved on this device for admin API requests. Clipboard copies include the secret value.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UiButton :aria-pressed="savedAdminTokenVisible" @click="savedAdminTokenVisible = !savedAdminTokenVisible">
              {{ savedAdminTokenVisible ? "Hide token" : "Reveal token" }}
            </UiButton>
            <UiButton variant="primary" @click="copyAdminToken('raw')">Copy token</UiButton>
            <UiButton variant="primary" @click="copyAdminToken('bearer')">Copy header</UiButton>
            <UiButton variant="danger" @click="clearAdminToken">Forget token</UiButton>
          </div>
        </div>
        <p v-if="adminCopyMessage" data-testid="admin-copy-message" class="text-sm text-muted">{{ adminCopyMessage }}</p>

        <div class="mt-3 grid gap-3" data-testid="admin-summary">
          <div>
            <h3 class="m-0">Research Jobs</h3>
            <p class="text-sm text-muted">Updated {{ adminSummary ? formatDateTime(adminSummary.generated_at) : "" }}</p>
          </div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 max-md:grid-cols-[repeat(auto-fit,minmax(96px,1fr))]">
            <UiPanel v-for="row in adminSummary?.status_counts ?? []" :key="row.status" variant="card">
              <span class="block text-xs text-muted">{{ row.status }}</span>
              <strong class="mt-1 block text-lg">{{ row.count }}</strong>
            </UiPanel>
          </div>
          <details>
            <summary class="cursor-pointer py-1 text-sm font-bold text-text-subtle">Recent Jobs</summary>
            <ol v-if="adminSummary && adminSummary.recent_jobs.length > 0" class="m-0 mt-2 pl-5">
              <li v-for="job in adminSummary.recent_jobs" :key="job.research_job_id" class="mb-3">
                <strong>{{ job.status }}</strong>
                <span class="mt-0.5 block">{{ job.original_user_query }}</span>
                <small class="block text-xs text-muted">{{ formatDateTime(job.created_at) }}</small>
                <p v-if="job.error_message" class="m-0 mt-1 text-sm text-danger">{{ job.error_message }}</p>
              </li>
            </ol>
            <p v-else class="text-sm text-muted">No jobs found.</p>
          </details>

          <div class="grid gap-2 border-t border-border pt-3" data-testid="admin-table-explorer">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="m-0">Data Tables</h3>
                <p class="text-sm text-muted">Browse allowlisted D1 tables.</p>
              </div>
              <UiButton :disabled="adminTableLoading" @click="loadAdminTableRows()">
                {{ adminTableLoading ? "Loading..." : "Refresh" }}
              </UiButton>
            </div>

            <div class="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Admin data tables">
              <button
                v-for="table in adminTables"
                :key="table.name"
                type="button"
                role="tab"
                :aria-selected="selectedAdminTable === table.name"
                :class="['inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-sm', selectedAdminTable === table.name ? 'border-primary bg-primary-soft text-primary-strong' : 'border-border-strong bg-surface text-text']"
                @click="selectAdminTable(table.name)"
              >
                <span>{{ table.label }}</span>
                <small class="text-muted">{{ table.count }}</small>
              </button>
            </div>

            <div v-if="adminTableRows" class="flex flex-wrap items-center justify-between gap-2">
              <span>{{ adminTableRows.table.label }}</span>
              <span>{{ adminTableRows.table.count === 0 ? "0 of 0" : `${adminTableRows.offset + 1}-${Math.min(adminTableRows.offset + adminTableRows.rows.length, adminTableRows.table.count)} of ${adminTableRows.table.count}` }}</span>
              <div class="flex gap-2">
                <UiButton :disabled="!canPageAdminBack || adminTableLoading" @click="pageAdminTable('previous')">Previous</UiButton>
                <UiButton :disabled="!canPageAdminForward || adminTableLoading" @click="pageAdminTable('next')">Next</UiButton>
              </div>
            </div>

            <div v-if="adminTableRows" class="grid gap-2 rounded-md border border-border bg-surface p-3 shadow-card">
              <div class="flex flex-wrap items-end gap-2">
                <label class="grid gap-1 text-xs font-semibold text-text-subtle">
                  Filter current page
                  <input v-model="adminTableFilter" data-testid="admin-table-filter" type="text" placeholder="Search loaded rows" class="min-w-[220px] rounded-md border border-border-strong px-3 py-2 text-sm" />
                </label>
                  <UiButton :disabled="!adminTableFilter && !adminTableSortColumn && adminSelectedRow === null" @click="clearAdminTableFilters">
                  Clear tools
                </UiButton>
                <p class="text-sm text-muted">{{ filteredAdminRows.length }} of {{ adminTableRows.rows.length }} loaded rows visible</p>
              </div>

              <div v-if="adminRowCopyMessage" data-testid="admin-row-copy-message" class="text-sm text-muted">{{ adminRowCopyMessage }}</div>

              <div class="max-h-[68vh] w-full overflow-x-auto overflow-y-auto rounded-md border border-border bg-surface max-md:max-h-[58vh]">
                <table v-if="sortedAdminRows.length > 0" data-testid="admin-data-table" class="min-w-max table-fixed border-collapse text-xs leading-[1.3]">
                  <thead>
                    <tr>
                      <th v-for="column in selectedAdminColumns" :key="column" class="sticky top-0 z-[1] w-[300px] min-w-[300px] max-w-[440px] whitespace-nowrap border-b border-border bg-surface-subtle px-3 py-2.5 text-left align-top font-semibold">
                        <button type="button" class="inline-flex items-center gap-1 text-left text-inherit" @click="toggleAdminTableSort(column)">
                          <span>{{ column }}</span>
                          <span v-if="adminTableSortColumn === column" class="text-muted">{{ adminTableSortDirection === 'asc' ? '▲' : '▼' }}</span>
                        </button>
                      </th>
                      <th class="sticky top-0 z-[1] border-b border-border bg-surface-subtle px-3 py-2.5 text-left align-top font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in sortedAdminRows" :key="rowIndex" :class="adminSelectedRow === row ? 'bg-primary-soft/40' : ''" @click="selectAdminRow(row)">
                      <td v-for="column in selectedAdminColumns" :key="column" class="w-[300px] min-w-[300px] max-w-[440px] whitespace-pre-wrap border-b border-border px-3 py-2.5 text-left align-top leading-[1.45] [overflow-wrap:anywhere]">
                        <span class="line-clamp-3 overflow-hidden" :title="formatCellValue(row[column])">{{ formatCellValue(row[column]) }}</span>
                      </td>
                      <td class="border-b border-border px-3 py-2.5 align-top">
                        <UiButton size="xs" @click.stop="selectAdminRow(row)">Details</UiButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="text-sm text-muted">No rows match the current-page filter.</p>
              </div>

              <UiPanel v-if="adminSelectedRow" variant="subtle" class="grid gap-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 class="m-0 text-sm font-semibold">Row details</h4>
                    <p class="m-0 text-xs text-muted">Current-page row JSON and copy action.</p>
                  </div>
                  <UiButton @click="copyAdminRowJson">Copy row JSON</UiButton>
                </div>
                <pre data-testid="admin-row-json" class="m-0 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-xs leading-[1.45]">{{ selectedAdminRowJson }}</pre>
              </UiPanel>
            </div>
          </div>
        </div>
      </div>

      <p v-if="adminError" data-testid="admin-error" class="m-0 mt-1 text-sm text-danger">{{ adminError }}</p>
    </UiPanel>
  </section>
</template>
