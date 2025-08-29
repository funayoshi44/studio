
"use client"

import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const sidebarVariants = cva(
  "group flex flex-col data-[collapsed=true]:items-center",
  {
    variants: {
      side: {
        left: "items-start",
        right: "items-end",
      },
    },
    defaultVariants: {
      side: "left",
    },
  }
)

export interface SidebarRootProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sidebarVariants> {
  children?: React.ReactNode
  /**
   * The collapsed state of the sidebar.
   *
   * @default false
   */
  collapsed?: boolean
  /**
   * The controlled collapsed state of the sidebar.
   *
   * @default undefined
   */
  collapsible?: boolean
  /**
   * The default collapsed state of the sidebar.
   *
   * @default false
   */
  defaultCollapsed?: boolean
  /**
   * The callback function to be called when the collapsed state changes.
   *
   * @default undefined
   */
  onCollapse?: (collapsed: boolean) => void
  /**
   * Whether to use the mobile layout.
   * This will be automatically determined based on the screen size, but you can override it.
   *
   * @default undefined
   */
  isMobile?: boolean
  /**
   * The value of the currently selected item.
   *
   * @default undefined
   */
  value?: string
  /**
   * The callback function to be called when the selected item changes.
   *
   * @default undefined
   */
  onValueChange?: (value: string) => void
}

type SidebarContextValue = {
  side: "left" | "right"
  isMobile: boolean
  collapsed: boolean
  collapsible: boolean
  onCollapse?: (collapsed: boolean) => void
  value?: string
  onValueChange?: (value: string) => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebarContext() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebarContext must be used within a Sidebar")
  }
  return context
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarRootProps>(
  (
    {
      className,
      children,
      collapsed: collapsedProp,
      collapsible = false,
      defaultCollapsed = false,
      onCollapse,
      isMobile: isMobileProp,
      side = "left",
      value,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const isMobileScreen = useIsMobile()
    const isMobile = isMobileProp ?? isMobileScreen
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

    const handleCollapse = React.useCallback(
      (collapsed: boolean) => {
        if (collapsedProp === undefined) {
          setCollapsed(collapsed)
        }
        onCollapse?.(collapsed)
      },
      [collapsedProp, onCollapse]
    )

    return (
      <SidebarContext.Provider
        value={{
          side,
          isMobile,
          collapsed: collapsedProp ?? collapsed,
          collapsible,
          onCollapse: handleCollapse,
          value,
          onValueChange,
        }}
      >
        <div
          ref={ref}
          className={cn(sidebarVariants({ side }), className)}
          data-collapsed={collapsedProp ?? collapsed}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    )
  }
)
Sidebar.displayName = "Sidebar"

type AsChildProps<T> = {
  asChild?: boolean
  children: React.ReactNode
} & T

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { collapsed } = useSidebarContext()

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-20 items-center justify-center p-4",
        !collapsed && "px-8",
        className
      )}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarHeaderTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { collapsed } = useSidebarContext()
  const Component = collapsed ? "div" : "p"

  return (
    <Component
      ref={ref}
      className={cn(
        "text-lg font-semibold text-foreground",
        collapsed && "text-center text-xs font-normal",
        className
      )}
      {...props}
    />
  )
})
SidebarHeaderTitle.displayName = "SidebarHeaderTitle"

const SidebarMain = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex-1", className)} {...props} />
))
SidebarMain.displayName = "SidebarMain"

export interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {}

const SidebarNav = React.forwardRef<HTMLDivElement, SidebarNavProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("grid auto-rows-max", className)}
        {...props}
      />
    )
  }
)
SidebarNav.displayName = "SidebarNav"

const SidebarNavMain = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { collapsed } = useSidebarContext()

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-y-1",
        !collapsed && "px-4",
        className
      )}
      {...props}
    />
  )
})
SidebarNavMain.displayName = "SidebarNavMain"

const sidebarNavItemVariants = cva(
  "flex items-center rounded-lg px-4 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      active: {
        true: "bg-sidebar-primary text-sidebar-primary-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
)

export interface SidebarNavItemProps
  extends React.HTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof sidebarNavItemVariants> {
  href: string
  asChild?: boolean
  value: string
  icon?: React.ReactNode
}

const SidebarNavItem = React.forwardRef<
  HTMLAnchorElement,
  SidebarNavItemProps
>(
  (
    {
      className,
      children,
      asChild,
      href,
      active: activeProp,
      value,
      icon,
      ...props
    },
    ref
  ) => {
    const {
      collapsed,
      value: contextValue,
      onValueChange,
    } = useSidebarContext()
    const Comp = asChild ? Slot : "a"
    const active = activeProp ?? contextValue === value

    return (
      <Comp
        ref={ref}
        href={href}
        className={cn(
          sidebarNavItemVariants({ active }),
          collapsed && "justify-center",
          className
        )}
        data-value={value}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        {icon}
        <Slottable>{children}</Slottable>
      </Comp>
    )
  }
)
SidebarNavItem.displayName = "SidebarNavItem"

const SidebarNavContent = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => {
  const { collapsed } = useSidebarContext()
  return (
    <span
      ref={ref}
      className={cn(
        "ml-4",
        collapsed &&
          "invisible absolute left-full ml-3 hidden w-max rounded-md bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-accent-foreground shadow-md group-hover:visible group-hover:z-10 group-hover:block",
        className
      )}
      {...props}
    />
  )
})
SidebarNavContent.displayName = "SidebarNavContent"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { collapsed } = useSidebarContext()

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-20 items-center justify-center border-t border-sidebar-border p-4",
        !collapsed && "px-8",
        className
      )}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("my-2 h-px bg-sidebar-border", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

export {
  Sidebar,
  SidebarHeader,
  SidebarHeaderTitle,
  SidebarMain,
  SidebarNav,
  SidebarNavMain,
  SidebarNavItem,
  SidebarNavContent,
  SidebarFooter,
  SidebarSeparator,
}
