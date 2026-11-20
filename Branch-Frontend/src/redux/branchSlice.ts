import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { searchBranches, getBranches } from "../app/branchApi";
import type { Branch } from "../types/BranchSchema";
import type { BranchQuery, BranchSearchRequest } from "../app/branchApi";

interface BranchState {
    branches: Branch[];
    totalElements: number;
    loading: boolean;
    error: string | null;
    currentRequestId?: string;
}

const initialState: BranchState = {
    branches: [], totalElements: 0, loading: false, error: null, currentRequestId: undefined
};

export const hasFilters = (f: BranchSearchRequest) =>
    Object.entries(f).some(([, value]) => {
        if (value == null || value === "") return false;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    });

export const fetchBranches = createAsyncThunk(
    "branch/fetchBranches",
    async ({ filters, page }: { filters: BranchSearchRequest; page: BranchQuery }, { signal }) => {
        const { data } = hasFilters(filters)
            ? await searchBranches(filters, page, signal)
            : await getBranches(page, signal);
        return { content: data?.content ?? [], totalElements: data?.totalElements ?? 0 };
    }
);
const branchSlice = createSlice({
    name: "branch",
    initialState,
    reducers: {
        setBranchLocally: (state, action: PayloadAction<Branch>) => {
            const branch = action.payload;
            const index = state.branches.findIndex(b => b.id === branch.id);
            if (index >= 0) state.branches[index] = branch;
            else {
                state.branches.unshift(branch);
                state.totalElements += 1;
            }
        },
        removeBranchLocally: (state, action: PayloadAction<number>) => {
            const exists = state.branches.some(b => b.id === action.payload);
            state.branches = state.branches.filter(b => b.id !== action.payload);
            if (exists) state.totalElements = Math.max(0, state.totalElements - 1);
        }
    },
    extraReducers: builder => builder
        .addCase(fetchBranches.pending, (state, action) => {
            state.loading = true;
            state.error = null;
            state.currentRequestId = action.meta.requestId;
        })
        .addCase(fetchBranches.fulfilled, (state, action) => {
            if (action.meta.requestId !== state.currentRequestId) return;
            state.loading = false;
            state.branches = action.payload.content;
            state.totalElements = action.payload.totalElements;
        })
        .addCase(fetchBranches.rejected, (state, action) => {
            if (action.meta.requestId !== state.currentRequestId) return;
            state.loading = false;
            if (!action.meta.aborted) {
                state.error = action.error.message || "Failed to load branches";
            }
        })
});

export const { setBranchLocally, removeBranchLocally } = branchSlice.actions;
export default branchSlice.reducer;