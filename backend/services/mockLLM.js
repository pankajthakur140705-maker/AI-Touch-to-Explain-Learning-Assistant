/**
 * Mock LLM Engine
 * 
 * Generates realistic-looking explanations based on highlighted text
 * and depth preference. Uses template-based responses that incorporate
 * the actual highlighted text for a convincing demo.
 * 
 * Validates: Requirements 6.1-6.7 (AI Explanation Generation)
 * 
 * Depth word counts:
 * - very-short: 50-100 words
 * - normal: 100-200 words
 * - detailed: 200-400 words
 */

const EXPLANATION_TEMPLATES = {
  'very-short': [
    (text) => `${text} refers to a fundamental concept in its field. In simple terms, it describes a process or idea that helps us understand how things work or relate to each other. Think of it like a building block — once you grasp this concept, many related ideas become clearer. For example, understanding ${text} can help you solve problems and make better decisions in practical situations.`,
    
    (text) => `At its core, ${text} is about understanding a key principle. It's a concept that experts use to explain complex phenomena in simpler terms. The main idea is that ${text} provides a framework for thinking about problems systematically. A good analogy would be a map — it gives you direction and helps you navigate through related topics with confidence.`,
    
    (text) => `${text} is an important concept that you'll encounter frequently. Simply put, it represents a way of organizing information or processes to achieve better outcomes. When you understand ${text}, you can apply it across different contexts. Consider it as a tool in your mental toolkit — the more you practice using it, the more intuitive it becomes.`,
  ],

  'normal': [
    (text) => `${text} is a significant concept that plays a central role in its domain. Let's break it down into understandable parts.

**What it is:** ${text} describes a systematic approach or principle that helps organize our understanding of a particular subject. It provides a framework for analyzing and solving problems within its field.

**Why it matters:** Understanding ${text} is crucial because it forms the foundation for many advanced topics. Without grasping this concept, it becomes difficult to progress to more complex ideas. It's like learning the alphabet before reading — essential and enabling.

**A simple example:** Imagine you're building a house. ${text} would be similar to understanding the blueprint — it tells you how different parts connect, what goes where, and why certain decisions are made. Just as a blueprint guides construction, ${text} guides your understanding and application of related concepts.

In practice, ${text} is used by professionals and learners alike to make informed decisions and create efficient solutions.`,

    (text) => `Understanding ${text} requires looking at it from multiple angles. This concept has evolved over time and remains relevant in modern applications.

**Definition:** ${text} can be understood as a principle or method that explains how certain elements interact or function together. It's a foundational idea that supports many related theories and practices.

**Key aspects:** The most important thing about ${text} is that it provides predictability and structure. When you apply this concept correctly, you can anticipate outcomes and make better decisions. This makes it invaluable for both theoretical understanding and practical application.

**Real-world connection:** Consider how ${text} applies in everyday situations. When you organize your day, prioritize tasks, or solve problems, you're often using principles related to ${text} without even realizing it. The concept is that universal.

**Moving forward:** As you continue learning about ${text}, try to identify it in different contexts. The more connections you make, the deeper your understanding becomes. This concept is a stepping stone to many exciting advanced topics.`,
  ],

  'detailed': [
    (text) => `# Understanding ${text}

## Definition and Overview
${text} is a comprehensive concept that encompasses several important principles within its field. At its most basic level, it describes a systematic way of approaching, understanding, and solving problems. The concept has been developed and refined over many years by researchers, practitioners, and thinkers who recognized patterns in how knowledge is organized and applied.

## Historical Context
The idea behind ${text} didn't emerge overnight. It evolved through careful observation and experimentation. Early thinkers noticed that certain patterns kept recurring, and they began to formalize these observations into what we now know as ${text}. This historical development is important because it shows how the concept has been tested and validated over time.

## Core Principles
There are several key principles that make ${text} work:

1. **Systematic Approach:** ${text} encourages breaking down complex problems into smaller, manageable parts. This divide-and-conquer strategy makes it easier to understand each component before seeing how they fit together.

2. **Interconnection:** Nothing exists in isolation. ${text} emphasizes how different elements relate to and influence each other. Understanding these relationships is key to mastering the concept.

3. **Practical Application:** Theory without practice is incomplete. ${text} is designed to be applied in real-world situations, making it both academically interesting and practically useful.

## Examples and Applications
Consider a simple example: when you're learning a new skill, you naturally apply principles of ${text}. You start with the basics, build connections between ideas, practice regularly, and gradually develop mastery. This mirrors exactly how ${text} works in its formal context.

In professional settings, ${text} is used to design systems, solve complex problems, and create efficient workflows. Engineers, scientists, educators, and business leaders all rely on variations of this concept.

## Common Misconceptions
One frequent misunderstanding is that ${text} is only relevant to experts. In reality, everyone uses aspects of this concept daily. Another misconception is that it's static — ${text} continues to evolve as our understanding deepens and new applications emerge.

## Summary
${text} is a foundational concept that provides structure, predictability, and a framework for understanding complex ideas. By mastering it, you unlock the ability to tackle advanced topics with confidence and apply your knowledge in meaningful ways.`,
  ],
};

/**
 * Generate a mock explanation for the given text and depth
 * @param {string} text - The highlighted text to explain
 * @param {string} depth - 'very-short' | 'normal' | 'detailed'
 * @returns {Promise<string>} The generated explanation
 */
async function generateExplanation(text, depth = 'normal') {
  // Simulate LLM processing delay (300-800ms)
  const delay = 300 + Math.random() * 500;
  await new Promise(resolve => setTimeout(resolve, delay));

  const templates = EXPLANATION_TEMPLATES[depth] || EXPLANATION_TEMPLATES['normal'];
  const templateIndex = Math.floor(Math.random() * templates.length);
  const explanation = templates[templateIndex](text.trim());

  return explanation;
}

/**
 * Validate depth preference
 */
function isValidDepth(depth) {
  return ['very-short', 'normal', 'detailed'].includes(depth);
}

module.exports = { generateExplanation, isValidDepth };
