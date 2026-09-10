import { GripVertical } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { PanResponder, Platform, View, type ScrollView, type ViewProps } from "react-native";
import { useAppTheme } from "../theme-context";
import { moveListItem, reorderTarget } from "../lib/reorder-list";

type Drag = { from: number; to: number; dy: number };
type RowLayout = { y: number; height: number };
export type ReorderScroll = {
  view: RefObject<ScrollView | null>;
  metrics: RefObject<{ offset: number; height: number; contentHeight: number }>;
};

/** Handles own the drag gesture, leaving text fields and normal page scrolling alone. */
export function ReorderableList<T>({ items, itemKey, itemLabel, onReorder, onDraggingChange, disabled = false, renderItem, scroll }: {
  items: T[];
  itemKey: (item: T) => string;
  itemLabel: (item: T, index: number) => string;
  onReorder: (items: T[]) => void;
  onDraggingChange: (active: boolean) => void;
  disabled?: boolean;
  scroll?: ReorderScroll;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const { colors } = useAppTheme();
  const layouts = useRef(new Map<string, RowLayout>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const active = useRef<Drag | null>(null);
  const motion = useRef({ dy: 0, pointerY: 0, startOffset: 0, viewportTop: 0, viewportHeight: 0 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef({ items, itemKey, onReorder, onDraggingChange, disabled });
  latest.current = { items, itemKey, onReorder, onDraggingChange, disabled };
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    latest.current.onDraggingChange(false);
  }, []);

  const finish = (commit: boolean) => {
    const state = active.current;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    active.current = null;
    setDrag(null);
    latest.current.onDraggingChange(false);
    if (commit && state && state.from !== state.to) {
      latest.current.onReorder(moveListItem(latest.current.items, state.from, state.to));
    }
  };
  const move = (dy: number) => {
    const state = active.current;
    if (!state) return;
    const rows = latest.current.items.map(item => layouts.current.get(latest.current.itemKey(item)));
    if (rows.some(row => !row)) return;
    const measured = rows as RowLayout[];
    const source = measured[state.from]!;
    const last = measured[measured.length - 1]!;
    const sourceCenter = source.y + source.height / 2;
    const clamped = Math.max(measured[0]!.height / 2 - sourceCenter - 1,
      Math.min(dy, last.y + last.height / 2 - sourceCenter + 1));
    const next = { from: state.from, to: reorderTarget(measured, state.from, clamped), dy: clamped };
    active.current = next;
    setDrag(next);
  };
  const reorderOne = (from: number, delta: number) => {
    if (latest.current.disabled || active.current) return;
    const to = from + delta;
    if (to >= 0 && to < latest.current.items.length) {
      latest.current.onReorder(moveListItem(latest.current.items, from, to));
    }
  };

  return <View style={{ gap: 8 }}>
    {items.map((item, index) => {
      const key = itemKey(item);
      const selected = drag?.from === index;
      const source = drag ? layouts.current.get(itemKey(items[drag.from]!)) : undefined;
      let translateY = selected ? drag.dy : 0;
      if (drag && source && !selected) {
        if (drag.from < index && index <= drag.to) translateY = -(source.height + 8);
        if (drag.to <= index && index < drag.from) translateY = source.height + 8;
      }
      return <View key={key}
        onLayout={event => layouts.current.set(key, event.nativeEvent.layout)}
        style={{ transform: [{ translateY }], zIndex: selected ? 2 : 0, elevation: selected ? 6 : 0, opacity: selected ? 0.94 : 1 }}>
        {renderItem(item, index, <DragHandle label={itemLabel(item, index)} disabled={disabled || items.length < 2}
          color={selected ? colors.primary : colors.muted}
          onStart={pointerY => {
            if (latest.current.disabled) return;
            active.current = { from: index, to: index, dy: 0 };
            setDrag(active.current);
            latest.current.onDraggingChange(true);
            motion.current = { dy: 0, pointerY, startOffset: scroll?.metrics.current.offset ?? 0, viewportTop: 0, viewportHeight: 0 };
            scroll?.view.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
              motion.current.viewportTop = y;
              motion.current.viewportHeight = height;
            });
            if (scroll) timer.current = setInterval(() => {
              if (!active.current) return;
              const gesture = motion.current;
              const metrics = scroll.metrics.current;
              const relativeY = gesture.pointerY - gesture.viewportTop;
              const direction = !gesture.viewportHeight ? 0 : relativeY < 48 ? -1 : relativeY > gesture.viewportHeight - 48 ? 1 : 0;
              if (direction) scroll.view.current?.scrollTo({
                y: Math.max(0, Math.min(metrics.contentHeight - metrics.height, metrics.offset + direction * 12)), animated: false,
              });
              move(gesture.dy + metrics.offset - gesture.startOffset);
            }, 32);
          }}
          onMove={(dy, pointerY) => {
            motion.current.dy = dy;
            motion.current.pointerY = pointerY;
            move(dy + (scroll?.metrics.current.offset ?? 0) - motion.current.startOffset);
          }} onFinish={finish} onStep={delta => reorderOne(index, delta)} />)}
      </View>;
    })}
  </View>;
}

function DragHandle({ label, color, disabled, onStart, onMove, onFinish, onStep }: {
  label: string; color: string; disabled: boolean;
  onStart: (pointerY: number) => void; onMove: (dy: number, pointerY: number) => void;
  onFinish: (commit: boolean) => void; onStep: (delta: number) => void;
}) {
  const handlers = useRef({ disabled, onStart, onMove, onFinish, onStep });
  handlers.current = { disabled, onStart, onMove, onFinish, onStep };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !handlers.current.disabled,
    onMoveShouldSetPanResponder: () => !handlers.current.disabled,
    onPanResponderGrant: event => handlers.current.onStart(event.nativeEvent.pageY),
    onPanResponderMove: (_event, gesture) => handlers.current.onMove(gesture.dy, gesture.moveY),
    onPanResponderRelease: () => handlers.current.onFinish(true),
    onPanResponderTerminate: () => handlers.current.onFinish(false),
    onPanResponderTerminationRequest: () => false,
  }), []);
  const keyboardProps = Platform.OS === "web" ? {
    tabIndex: disabled ? -1 : 0,
    onKeyDown: (event: { key: string; preventDefault: () => void }) => {
      if (disabled) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        onStep(event.key === "ArrowUp" ? -1 : 1);
      }
      if (event.key === "Escape") onFinish(false);
    },
  } as ViewProps : {};
  return <View {...pan.panHandlers} {...keyboardProps}
    accessible accessibilityRole="adjustable" accessibilityLabel={`${label} 순서 변경`}
    accessibilityHint="손잡이를 위아래로 드래그하세요. 키보드는 위아래 방향키로 이동합니다."
    accessibilityState={{ disabled }}
    accessibilityActions={[{ name: "increment", label: "아래로 이동" }, { name: "decrement", label: "위로 이동" }]}
    onAccessibilityAction={event => !disabled && onStep(event.nativeEvent.actionName === "increment" ? 1 : -1)}
    style={{ width: 32, minHeight: 40, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1,
      ...(Platform.OS === "web" ? { touchAction: "none", cursor: disabled ? "default" : "grab", userSelect: "none" } as object : {}) }}>
    <GripVertical size={17} strokeWidth={1.6} color={color} />
  </View>;
}
