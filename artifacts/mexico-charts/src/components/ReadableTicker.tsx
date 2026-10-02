import { useState, type CSSProperties } from "react";
import "./readable-ticker.css";

type Props = {
  id: string;
  label: string;
  items: readonly string[];
  className: string;
  itemClassName: string;
  style?: CSSProperties;
  paused: boolean;
  onToggle: () => void;
  controls: string;
  pauseLabel: string;
  resumeLabel: string;
  pauseText: string;
  resumeText: string;
  reducedText: string;
  slow?: boolean;
};

export default function ReadableTicker(props: Props) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const group = () => props.items.map((item, index) => (
    <span className={`mc-ticker-item ${props.itemClassName}`} key={index}>
      {item}<span className="mc-ticker-separator" aria-hidden="true">·</span>
    </span>
  ));

  return (
    <div id={props.id} role="group" aria-label={props.label}
      className={`mc-ticker ${props.className}`} style={props.style}
      data-paused={props.paused} data-slow={Boolean(props.slow)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}>
      <div className="mc-ticker-viewport" id={`${props.id}-content`}>
        <div className="mc-ticker-track" style={{ animationPlayState: hovered || focused ? "paused" : "running" }}>
          <span className="mc-ticker-original">{group()}</span>
          <span className="mc-ticker-clone" aria-hidden="true">{group()}</span>
        </div>
      </div>
      <button type="button" className="mc-ticker-control"
        aria-controls={props.controls} aria-label={props.paused ? props.resumeLabel : props.pauseLabel}
        onClick={props.onToggle}>
        {props.paused ? props.resumeText : props.pauseText}
      </button>
      <span className="mc-ticker-reduced-note">{props.reducedText}</span>
    </div>
  );
}
