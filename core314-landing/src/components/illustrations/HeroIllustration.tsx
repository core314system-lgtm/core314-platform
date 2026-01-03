import { motion } from 'framer-motion';

// Inner ring integrations (closer to center) - communication & productivity
const innerRing = [
  { angle: 0, label: 'Slack' },
  { angle: 60, label: 'Teams' },
  { angle: 120, label: 'Gmail' },
  { angle: 180, label: 'Jira' },
  { angle: 240, label: 'HubSpot' },
  { angle: 300, label: 'Salesforce' },
];

// Outer ring integrations (farther out) - extended ecosystem
const outerRing = [
  { angle: 30, label: 'Outlook' },
  { angle: 90, label: 'Asana' },
  { angle: 150, label: 'Trello' },
  { angle: 210, label: 'GitHub' },
  { angle: 270, label: 'Notion' },
  { angle: 330, label: 'Drive' },
];

// Calculate position from angle and radius
const getPosition = (angle: number, radius: number, centerX: number, centerY: number) => {
  const radian = (angle - 90) * (Math.PI / 180);
  return {
    x: centerX + radius * Math.cos(radian),
    y: centerY + radius * Math.sin(radian),
  };
};

const centerX = 300;
const centerY = 200;
const innerRadius = 120;
const outerRadius = 180;

export default function HeroIllustration() {
  return (
    <div className="w-full flex flex-col items-center">
      <svg
        viewBox="0 0 600 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-3xl mx-auto"
      >
        {/* Outer decorative ring */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={outerRadius + 30}
          fill="none"
          stroke="#0EA5E9"
          strokeWidth="1"
          strokeOpacity="0.08"
          strokeDasharray="8 8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        />
        
        {/* Middle decorative ring */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={innerRadius + 15}
          fill="none"
          stroke="#0EA5E9"
          strokeWidth="1"
          strokeOpacity="0.1"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        />
        
        {/* Central Core314 hub - outer glow */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r="55"
          fill="#0EA5E9"
          fillOpacity="0.08"
          stroke="#0EA5E9"
          strokeWidth="2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        
        {/* Central Core314 hub - inner */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r="40"
          fill="#0EA5E9"
          fillOpacity="0.12"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
        
        {/* Core314 label */}
        <motion.text
          x={centerX}
          y={centerY + 5}
          textAnchor="middle"
          fill="#0369A1"
          fontSize="14"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          Core314
        </motion.text>
        
        {/* Inner ring integration nodes */}
        {innerRing.map((node, i) => {
          const pos = getPosition(node.angle, innerRadius, centerX, centerY);
          const delay = 0.4 + i * 0.08;
          return (
            <g key={`inner-${i}`}>
              {/* Connection line */}
              <motion.line
                x1={centerX}
                y1={centerY}
                x2={pos.x}
                y2={pos.y}
                stroke="#0EA5E9"
                strokeWidth="1.5"
                strokeOpacity="0.2"
                strokeDasharray="4 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay }}
              />
              
              {/* Node circle */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r="28"
                fill="#F8FAFC"
                stroke="#0EA5E9"
                strokeWidth="1.5"
                strokeOpacity="0.5"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: delay + 0.15 }}
              />
              
              {/* Inner accent */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r="12"
                fill="#0EA5E9"
                fillOpacity="0.12"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: delay + 0.25 }}
              />
              
              {/* Label */}
              <motion.text
                x={pos.x}
                y={pos.y + 4}
                textAnchor="middle"
                fill="#0F172A"
                fontSize="9"
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: delay + 0.35 }}
              >
                {node.label}
              </motion.text>
            </g>
          );
        })}
        
        {/* Outer ring integration nodes */}
        {outerRing.map((node, i) => {
          const pos = getPosition(node.angle, outerRadius, centerX, centerY);
          const delay = 0.7 + i * 0.08;
          return (
            <g key={`outer-${i}`}>
              {/* Connection line */}
              <motion.line
                x1={centerX}
                y1={centerY}
                x2={pos.x}
                y2={pos.y}
                stroke="#0EA5E9"
                strokeWidth="1"
                strokeOpacity="0.15"
                strokeDasharray="4 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay }}
              />
              
              {/* Node circle - slightly smaller for outer ring */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r="24"
                fill="#F8FAFC"
                stroke="#0EA5E9"
                strokeWidth="1"
                strokeOpacity="0.4"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: delay + 0.15 }}
              />
              
              {/* Inner accent */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r="10"
                fill="#0EA5E9"
                fillOpacity="0.1"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: delay + 0.25 }}
              />
              
              {/* Label */}
              <motion.text
                x={pos.x}
                y={pos.y + 4}
                textAnchor="middle"
                fill="#1E293B"
                fontSize="8"
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: delay + 0.35 }}
              >
                {node.label}
              </motion.text>
            </g>
          );
        })}
        
        {/* Subtle data flow indicators */}
        {[0, 1, 2].map((i) => {
          const sourceNode = innerRing[i * 2];
          const sourcePos = getPosition(sourceNode.angle, innerRadius, centerX, centerY);
          return (
            <motion.circle
              key={`flow-${i}`}
              r="3"
              fill="#0EA5E9"
              fillOpacity="0.5"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0.7, 0],
                cx: [sourcePos.x, centerX],
                cy: [sourcePos.y, centerY],
              }}
              transition={{
                duration: 2.5,
                delay: 1.5 + i * 0.9,
                repeat: Infinity,
                repeatDelay: 2,
              }}
            />
          );
        })}
      </svg>
      
      {/* Caption beneath illustration */}
      <motion.p
        className="text-center text-slate-400 text-sm mt-4"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
      >
        Shown: a small sample of the many integrations available in Core314.
      </motion.p>
    </div>
  );
}
