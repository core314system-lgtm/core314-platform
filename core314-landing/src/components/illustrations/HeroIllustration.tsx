import { motion } from 'framer-motion';

export default function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-md mx-auto"
    >
      {/* Central hub */}
      <motion.circle
        cx="200"
        cy="150"
        r="40"
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
        r="25"
        fill="#0EA5E9"
        fillOpacity="0.2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      />
      
      {/* Connected nodes */}
      {[
        { cx: 80, cy: 80, delay: 0.5 },
        { cx: 320, cy: 80, delay: 0.6 },
        { cx: 80, cy: 220, delay: 0.7 },
        { cx: 320, cy: 220, delay: 0.8 },
        { cx: 50, cy: 150, delay: 0.9 },
        { cx: 350, cy: 150, delay: 1.0 },
      ].map((node, i) => (
        <g key={i}>
          <motion.line
            x1="200"
            y1="150"
            x2={node.cx}
            y2={node.cy}
            stroke="#0EA5E9"
            strokeWidth="1.5"
            strokeOpacity="0.3"
            strokeDasharray="4 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: node.delay }}
          />
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r="20"
            fill="#F0F9FF"
            stroke="#0EA5E9"
            strokeWidth="1.5"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: node.delay + 0.2 }}
          />
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r="8"
            fill="#0EA5E9"
            fillOpacity="0.3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: node.delay + 0.4 }}
          />
        </g>
      ))}
      
      {/* Data flow indicators */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={`flow-${i}`}
          r="4"
          fill="#0EA5E9"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
            cx: [80, 200],
            cy: [80, 150],
          }}
          transition={{
            duration: 2,
            delay: i * 0.7,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        />
      ))}
    </svg>
  );
}
