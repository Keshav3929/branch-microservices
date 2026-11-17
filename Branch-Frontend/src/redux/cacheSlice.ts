import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { DropdownOptions, BranchAnalytics, UserOption } from "../app/branchApi";
import { getDropdownOptions, getAnalytics, getUsers } from "../app/branchApi";

interface CacheEntry<T> {
    data: T | null;
    timestamp: number;
    stale: boolean;
}

interface CacheState {
    dropdownOptions: CacheEntry<DropdownOptions>;
    analytics: CacheEntry<BranchAnalytics>;
    users: CacheEntry<UserOption[]>;
}

const initialState: CacheState = {
    dropdownOptions: { data: null, timestamp: 0, stale: true },
    analytics: { data: null, timestamp: 0, stale: true },
    users: { data: null, timestamp: 0, stale: true },
};

// TTL in milliseconds
const DROPDOWN_TTL = 5 * 60 * 1000; // 5 minutes
const ANALYTICS_TTL = 2 * 60 * 1000; // 2 minutes
const USERS_TTL = 10 * 60 * 1000; // 10 minutes

const isFresh = (entry: CacheEntry<unknown>, ttl: number): boolean => {
    if (!entry.data || entry.stale) return false;
    return Date.now() - entry.timestamp < ttl;
};

// Async thunks with cache-aware fetching
export const fetchDropdownOptions = createAsyncThunk<DropdownOptions, void, { state: { cache: CacheState } }>(
    "cache/fetchDropdownOptions",
    async (_, { getState, rejectWithValue }) => {
        const cached = getState().cache.dropdownOptions;
        if (isFresh(cached, DROPDOWN_TTL)) {
            return cached.data!;
        }
        try {
            const response = await getDropdownOptions();
            return response.data;
        } catch (err) {
            return rejectWithValue(err);
        }
    }
);

export const fetchAnalytics = createAsyncThunk<BranchAnalytics, void, { state: { cache: CacheState } }>(
    "cache/fetchAnalytics",
    async (_, { getState, rejectWithValue }) => {
        const cached = getState().cache.analytics;
        if (isFresh(cached, ANALYTICS_TTL)) {
            return cached.data!;
        }
        try {
            const response = await getAnalytics();
            return response.data;
        } catch (err) {
            return rejectWithValue(err);
        }
    }
);

export const fetchUsers = createAsyncThunk<UserOption[], void, { state: { cache: CacheState } }>(
    "cache/fetchUsers",
    async (_, { getState, rejectWithValue }) => {
        const cached = getState().cache.users;
        if (isFresh(cached, USERS_TTL)) {
            return cached.data!;
        }
        try {
            const response = await getUsers();
            return response.data;
        } catch (err) {
            return rejectWithValue(err);
        }
    }
);

const cacheSlice = createSlice({
    name: "cache",
    initialState,
    reducers: {
        setDropdownOptions: (state, action: PayloadAction<DropdownOptions>) => {
            state.dropdownOptions = { data: action.payload, timestamp: Date.now(), stale: false };
        },
        setAnalytics: (state, action: PayloadAction<BranchAnalytics>) => {
            state.analytics = { data: action.payload, timestamp: Date.now(), stale: false };
        },
        setUsers: (state, action: PayloadAction<UserOption[]>) => {
            state.users = { data: action.payload, timestamp: Date.now(), stale: false };
        },
        invalidateDropdownOptions: (state) => {
            state.dropdownOptions.stale = true;
        },
        invalidateAnalytics: (state) => {
            state.analytics.stale = true;
        },
        invalidateUsers: (state) => {
            state.users.stale = true;
        },
        invalidateAll: (state) => {
            state.dropdownOptions.stale = true;
            state.analytics.stale = true;
            state.users.stale = true;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDropdownOptions.fulfilled, (state, action) => {
                state.dropdownOptions = { data: action.payload, timestamp: Date.now(), stale: false };
            })
            .addCase(fetchAnalytics.fulfilled, (state, action) => {
                state.analytics = { data: action.payload, timestamp: Date.now(), stale: false };
            })
            .addCase(fetchUsers.fulfilled, (state, action) => {
                state.users = { data: action.payload, timestamp: Date.now(), stale: false };
            });
    },
});

export const {
    setDropdownOptions,
    setAnalytics,
    setUsers,
    invalidateDropdownOptions,
    invalidateAnalytics,
    invalidateUsers,
    invalidateAll,
} = cacheSlice.actions;

// Selectors
export const selectDropdownOptions = (state: { cache: CacheState }) => state.cache.dropdownOptions;
export const selectAnalytics = (state: { cache: CacheState }) => state.cache.analytics;
export const selectUsers = (state: { cache: CacheState }) => state.cache.users;

export const selectFreshDropdownOptions = (state: { cache: CacheState }) =>
    isFresh(state.cache.dropdownOptions, DROPDOWN_TTL) ? state.cache.dropdownOptions.data : null;

export const selectFreshAnalytics = (state: { cache: CacheState }) =>
    isFresh(state.cache.analytics, ANALYTICS_TTL) ? state.cache.analytics.data : null;

export const selectFreshUsers = (state: { cache: CacheState }) =>
    isFresh(state.cache.users, USERS_TTL) ? state.cache.users.data : null;

export default cacheSlice.reducer;