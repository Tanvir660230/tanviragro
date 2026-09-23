/* ────────────────────────────────────────────────────────────────
 * Enterprise Component Library — Barrels
 * Single source of truth for all reusable UI primitives.
 * Import everything via `@/components/ui`
 * ──────────────────────────────────────────────────────────────── */

/* ── Primitives ── */
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion"
export { AutoPrint } from "./auto-print"
export {
  Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge,
} from "./avatar"
export { Badge, badgeVariants } from "./badge"
export { Button, buttonVariants, type ButtonProps } from "./button"
export {
  Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent, cardVariants,
} from "./card"
export { Checkbox } from "./checkbox"
export { Chip, chipVariants } from "./chip"
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "./dialog"
export { Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from "./drawer"
export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "./dropdown-menu"
export { ErrorBoundary } from "./ErrorBoundary"
export { Input, type InputProps } from "./input"
export { Label } from "./label"
export { LoadingState, InlineSpinner } from "./loading-state"
export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover"
export { PrintButton } from "./print-button"
export { RadioGroup, RadioGroupItem } from "./radio-group"
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from "./select"
export { Separator } from "./separator"
export { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "./sheet"
export { Skeleton } from "./skeleton"
export { StatusBadge } from "./status-badge"
export { SuccessState } from "./success-state"
export { Switch } from "./switch"
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "./table"
export { Tabs, TabsList, TabsTab, TabsPanel, TabsTab as TabsTrigger, TabsPanel as TabsContent } from "./tabs"
export { Textarea } from "./textarea"
export { toast } from "./toast"
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip"
export { DataPagination, DateRangeFilter } from "./data-pagination"

/* ── Form system ── */
export { FormField, FormLabel, FormHint, FormError, FormHelperText, CharacterCounter, RequiredIndicator, FormSection, FormGroup } from "./form-field"
export { CurrencyInput } from "./currency-input"
export { DateInput, TimeInput } from "./date-time-input"
export { MultiSelect, type MultiSelectOption, type MultiSelectProps } from "./multi-select"
export { OtpInput } from "./otp-input"
export { SearchInput } from "./search-input"
export { SegmentedControl } from "./segmented-control"
export { TagPicker } from "./tag-picker"

/* ── Feedback ── */
export { Alert, Banner } from "./alert"
export { Progress, LinearLoader } from "./progress"

/* ── Data display ── */
export { StatCard, MetricCard, ProgressCard } from "./stat-card"
export { Timeline, ActivityFeed, AuditLog } from "./timeline"
export { TreeView } from "./tree-view"
export { AuditLog as AuditLogTable } from "./timeline"

/* ── Navigation ── */
export { Stepper } from "./stepper"
export { VerticalTabs } from "./vertical-tabs"

/* ── Overlays & menus ── */
export { HoverCard } from "./hover-card"
export { ContextMenu } from "./context-menu"
export { SplitButton } from "./split-button"

/* ── Composition & states ── */
export { CardSkeleton, TableSkeleton, ListSkeleton, ChartSkeleton, PageSkeleton } from "./skeleton-variants"
export { EmptySearchState, EmptyPermissionState, EmptyOfflineState, EmptyDataState, EmptyFirstTimeState, EmptyErrorState } from "./empty-state-variants"

/* ── Charts (recharts wrappers) ── */
export { ChartContainer, ChartTooltip, ChartLegend, CHART_COLORS } from "./chart"
export { LineChart, AreaChart, BarChart, PieChart, type ChartSeries, type ChartDataPoint, type PieDatum } from "./chart"