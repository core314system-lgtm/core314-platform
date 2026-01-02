import { motion } from 'framer-motion';

const integrations = [
  { cx: 80, cy: 70, delay: 0.5, label: 'Slack' },
  { cx: 320, cy: 70, delay: 0.6, label: 'Teams' },
  { cx: 50, cy: 150, delay: 0.7, label: 'Gmail' },
  { cx: 350, cy: 150, delay: 0.8, label: 'Jira' },
  { cx: 80, cy: 230, delay: 0.9, label: 'HubSpot' },
  { cx: 320, cy: 230, delay: 1.0, label: 'Salesforce' },
];

export default function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-lg mx-auto"
    >
      {/* Central Core314 hub */}
      <motion.circle
        cx="200"
        cy="150"
        r="45"
        fill="#0EA5E9"
        fillOpacity="0.1"
        stroke="#0EA5E9"
        strokeWidth="2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />
      <motion.circle
        cx="200"
        cy="150"
        r="32"
        fill="#0EA5E9"
        fillOpacity="0.15"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      />
      
      {/* Core314 label */}
      <motion.text
        x="200"
        y="154"
        textAnchor="middle"
        fill="#0369A1"
        fontSize="11"
        fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        Core314
      </motion.text>
      
      {/* Connected integration nodes */}
      {integrations.map((node, i) => (
        <g key={i}>
          {/* Connection line */}
          <motion.line
            x1="200"
            y1="150"
            x2={node.cx}
            y2={node.cy}
            stroke="#0EA5E9"
            strokeWidth="1.5"
            strokeOpacity="0.25"
            strokeDasharray="4 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: node.delay }}
          />
          
          {/* Node circle */}
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r="24"
            fill="#F8FAFC"
            stroke="#0EA5E9"
            strokeWidth="1.5"
            strokeOpacity="0.6"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: node.delay + 0.2 }}
          />
          
          {/* Inner accent circle */}
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r="10"
            fill="#0EA5E9"
            fillOpacity="0.15"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: node.delay + 0.4 }}
          />
          
          {/* Integration label */}
          <motion.text
            x={node.cx}
            y={node.cy + 4}
            textAnchor="middle"
            fill="#475569"
            fontSize="8"
            fontWeight="500"
            fontFamily="Inter, system-ui, sans-serif"
            letterSpacing="0.02em"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: node.delay + 0.5 }}
          >
            {node.label}
          </motion.text>
        </g>
      ))}
      
      {/* Subtle data flow indicators */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={`flow-${i}`}
          r="3"
          fill="#0EA5E9"
          fillOpacity="0.6"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.8, 0],
            cx: [integrations[i * 2].cx, 200],
            cy: [integrations[i * 2].cy, 150],
          }}
          transition={{
            duration: 2.5,
            delay: i * 0.8,
            repeat: Infinity,
            repeatDelay: 1.5,
          }}
        />
      ))}
    </svg>
  );
}
