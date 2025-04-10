import { startCooldownFor } from "./contract/cooldowns";

const t = startCooldownFor("0xcE6fF2Ad12F4A27d490FEd5A42b0fDDEf164D6F5", "Tree", 0);
console.log("t", t);
