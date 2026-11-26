import type { ReactNode, KeyboardEvent, ChangeEvent } from "react";
import { Autocomplete as MuiAutocomplete, TextField as MuiTextField, Chip } from "@mui/material";
import { useState, useEffect, useMemo } from "react";

export type AutoCompleteOption = { id: number | string; name: string } | string | number;
export type AutoCompleteValue = AutoCompleteOption | AutoCompleteOption[] | null;

interface MultiSelectAutoCompleteProps {
    label: string;
    options: AutoCompleteOption[];
    value: AutoCompleteValue;
    onChange: (value: AutoCompleteValue) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    multiple?: boolean;
    freeSolo?: boolean;
    disableClearable?: boolean;
    disableSuggestions?: boolean;
    error?: boolean;
    helperText?: ReactNode;
    fullWidth?: boolean;
    size?: "small" | "medium";
    placeholder?: string;
    endAdornment?: ReactNode;
    inputValue?: string;
    onInputChange?: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    allOption?: string;
    allOptionValues?: string[];            
}

export default function MultiSelectAutoComplete({
    label, options, value, onChange, multiple = false, freeSolo = false,
    disableClearable = false, disableSuggestions = false, error = false,
    helperText, fullWidth = true, size = "small", placeholder, endAdornment,
    inputValue, onInputChange, onKeyDown, onFocus, onBlur,
    allOption, allOptionValues
}: MultiSelectAutoCompleteProps) {
    const [internalValue, setInternalValue] = useState<AutoCompleteValue>(value);

    // Sync internal value with props
    useEffect(() => {
        setInternalValue(value);
    }, [value]);

    const getOptionLabel = (option: AutoCompleteOption) =>
        typeof option === "object" ? option.name : String(option);

    const isOptionEqualToValue = (option: AutoCompleteOption, val: AutoCompleteOption) =>
        typeof option === "object" && typeof val === "object"
            ? option.id === val.id
            : typeof option === "object" ? option.id === val
                : typeof val === "object" ? option === val.id : option === val;

    const selectedValue = (item: AutoCompleteOption | null) =>
        item == null ? null : options.find(option => isOptionEqualToValue(option, item)) ?? item;

    const normalizedValue = useMemo(() => {
        if (!multiple) {
            return selectedValue(Array.isArray(value) ? value[0] ?? null : value);
        }
        return (Array.isArray(value) ? value : value == null ? [] : [value])
            .map(item => selectedValue(item as AutoCompleteOption))
            .filter((item): item is AutoCompleteOption => item !== null);
    }, [value, multiple, options]);

    const handleChange = (event: React.SyntheticEvent, newValue: AutoCompleteValue) => {
        if (!multiple || !allOption || !allOptionValues || allOptionValues.length === 0) {
            onChange(newValue as AutoCompleteValue);
            return;
        }

        const newArray = Array.isArray(newValue) ? newValue : newValue == null ? [] : [newValue];
        const newStrings = newArray.map(getOptionLabel);
        const hasAll = newStrings.includes(allOption);
        const prevHasAll = allOptionValues.every(v => normalizedValue && (Array.isArray(normalizedValue) ? normalizedValue : []).map(getOptionLabel).includes(v));

        let resultStrings: string[];

        if (hasAll && !prevHasAll) {
            resultStrings = allOptionValues;
        } else if (!hasAll && prevHasAll) {
            resultStrings = [];
        } else {
            const allIndividualSelected = allOptionValues.every(v => newStrings.includes(v));
            if (allIndividualSelected) {
                resultStrings = [...allOptionValues, allOption];
            } else {
                resultStrings = newStrings.filter(v => v !== allOption);
            }
        }

        onChange(resultStrings as AutoCompleteValue);
    };

    const showAllSelected = multiple && allOption && allOptionValues && allOptionValues.length > 0
        ? allOptionValues.every(v => {
            const valArray = Array.isArray(normalizedValue) ? normalizedValue : [];
            return valArray.map(getOptionLabel).includes(v);
        })
        : false;

    const displayValue = useMemo(() => {
        if (!multiple || !allOption || !allOptionValues) {
            return normalizedValue;
        }
        if (showAllSelected) {
            const baseArray = Array.isArray(normalizedValue) ? normalizedValue : [];
            const hasAllInValue = baseArray.map(getOptionLabel).includes(allOption);
            if (!hasAllInValue) {
                return [...baseArray, allOption];
            }
        }
        return normalizedValue;
    }, [normalizedValue, multiple, allOption, allOptionValues, showAllSelected]);

    return (
        <MuiAutocomplete
            multiple={multiple}
            freeSolo={freeSolo}
            disableClearable={disableClearable}
            open={disableSuggestions ? false : undefined}
            forcePopupIcon={disableSuggestions ? false : undefined}
            size={size}
            fullWidth={fullWidth}
            options={options}
            getOptionLabel={getOptionLabel}
            isOptionEqualToValue={isOptionEqualToValue}
            value={displayValue as never}
            onChange={handleChange}
            inputValue={inputValue}
            onInputChange={onInputChange ? (_, val) => onInputChange(val) : undefined}
            filterOptions={disableSuggestions ? options => options : undefined}
            renderValue={multiple ? (selected, getItemProps) =>
                (Array.isArray(selected) ? selected : [selected]).map((option, index) => {
                    const optLabel = getOptionLabel(option);
                    if (optLabel === allOption) return null;
                    return (
                        <Chip {...getItemProps({ index })} key={index}
                            label={optLabel} size="small" />
                    );
                }) : undefined}
            renderInput={params => (
                <MuiTextField
                    {...params}
                    size={size}
                    margin="dense"
                    label={label}
                    placeholder={placeholder}
                    error={error}
                    helperText={helperText}
                    onKeyDown={onKeyDown}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    InputProps={{
                        ...params.InputProps,
                        ...(endAdornment ? {
                            endAdornment: <>{endAdornment}{params.InputProps.endAdornment}</>
                        } : {})
                    }}
                />
            )}
        />
    );
}