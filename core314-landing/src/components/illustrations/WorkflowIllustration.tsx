import { motion } from 'framer-motion';

export default function WorkflowIllustration() {
  return (
    <svg
      viewBox="0 0 300 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-sm mx-auto"
    >
      {/* Process steps */}
      {[
        { x: 40, label: '1' },
        { x: 130, label: '2' },
        { x: 220, label: '3' },
      ].map((step, i) => (
        <g key={i}>
          {/* Connecting arrow */}
          {i < 2 && (
            <motion.path
              d={`M ${step.x + 35} 100 L ${step.x + 55} 100`}
              stroke="#0EA5E9"
              strokeWidth="2"
              strokeOpacity="0.4"
              markerEnd="url(#arrowhead)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.3 }}
            />
          )}
          
          {/* Step circle */}
          <motion.circle
            cx={step.x + 20}
            cy="100"
            r="28"
            fill="#F0F9FF"
            stroke="#0EA5E9"
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.2 }}
          />
          
          {/* Step number */}
          <motion.text
            x={step.x + 20}
            y="106"
            textAnchor="middle"
            fill="#0EA5E9"
            fontSize="16"
            fontWeight="600"
            fontFamily="Poppins, sans-serif"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.2 }}
          >
            {step.label}
          </motion.text>
        </g>
      ))}
      
      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#0EA5E9" fillOpacity="0.4" />
        </marker>
      </defs>
      
      {/* Decorative elements */}
      <motion.rect
        x="20"
        y="150"
        width="260"
        height="4"
        rx="2"
        fill="#0EA5E9"
        fillOpacity="0.1"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      />
      
      {/* Progress indicator */}
      <motion.rect
        x="20"
        y="150"
        width="260"
        height="4"
        rx="2"
        fill="#0EA5E9"
        fillOpacity="0.3"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 1 }}
        style={{ transformOrigin: 'left' }}
      />
    </svg>
  );
}
