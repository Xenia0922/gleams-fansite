import { motion } from 'framer-motion';

export default function HeroTitle({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-[10px] sm:text-xs tracking-[0.3em] text-gray-400 uppercase mb-3 sm:mb-4"
      >
        {subtitle}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-3 sm:mb-4"
      >
        {name}
      </motion.h1>
    </>
  );
}
