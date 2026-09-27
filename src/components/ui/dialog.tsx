"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 backdrop-blur-md duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * The phone's Back button closes an open dialog instead of leaving the page: opening pushes one
 * history entry (same URL, Next's own state kept), Back pops it and the dialog closes; closing the
 * dialog normally removes the entry again. A nested dialog closes first, then the one below it.
 */
// Open dialogs, newest last, each with one history entry of its own. The phone's Back pops the
// newest entry: the newest dialog closes. A dialog closed any other way takes its entry off again
// (the resulting popstate is ignored), unless it led to another page.
const dialogStack: string[] = []
const dialogClosers = new Map<string, () => void>()
const mountedDialogs = new Set<string>()
let ignoredPops = 0
let listening = false

function onDialogPop() {
  if (ignoredPops > 0) { ignoredPops--; return }
  const top = dialogStack.pop()
  if (top) dialogClosers.get(top)?.()
}

function BackButtonCloses() {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!listening) { window.addEventListener("popstate", onDialogPop); listening = true }
    mountedDialogs.add(id)
    dialogClosers.set(id, () => closeRef.current?.click())
    if (!dialogStack.includes(id)) {
      dialogStack.push(id)
      window.history.pushState({ ...(window.history.state ?? {}), __dialog: id }, "")
    }
    const href = window.location.href
    return () => {
      mountedDialogs.delete(id)
      setTimeout(() => {
        if (mountedDialogs.has(id)) return                 // only re-mounted
        dialogClosers.delete(id)
        const at = dialogStack.indexOf(id)
        if (at === -1) return                              // closed by Back: entry already gone
        dialogStack.splice(at, 1)
        if (window.location.href === href) { ignoredPops++; window.history.back() }
      }, 0)
    }
  }, [id])
  return <DialogPrimitive.Close ref={closeRef} tabIndex={-1} aria-hidden className="sr-only" />
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] sm:max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl bg-card p-6 text-sm text-card-foreground border border-border/70 shadow-floating duration-200 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        <BackButtonCloses />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                size="icon-sm"
              />
            }
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // bleeds to the dialog's edges through its p-6; a dialog without padding (p-0, e.g. a
        // scrolling body with its own padding) keeps the footer inside, never wider than the screen
        "-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-2xl border-t border-border/60 bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end [.p-0>&]:mx-0 [.p-0>&]:mb-0",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-lg font-semibold leading-snug tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
