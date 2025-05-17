"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cooldowns_1 = require("./contract/cooldowns");
async function testCooldownFor() {
    const coolDownTypes = ["Tree", "Flax", "Rock"];
    while (true) {
        //Random wait time between 60 and 100 seconds
        const waitTime = Math.floor(Math.random() * (40 - 30 + 1)) + 30;
        const randomIndex = Math.floor(Math.random() * coolDownTypes.length);
        const randomType = coolDownTypes[randomIndex];
        const randomCoolDownIndex = Math.floor(Math.random() * 10);
        console.log("Waiting..." + waitTime + " seconds for " + randomType + " " + randomCoolDownIndex);
        const cooldown = await (0, cooldowns_1.startCooldownFor)("0x7990ec7597e6215958c9bbef7d555f7b72f6b8de", randomType, 0);
        console.log(cooldown);
        await new Promise((resolve) => setTimeout(resolve, 1000 * waitTime));
        // Wait for 10 seconds
        // const wait = new Promise((resolve) => setTimeout(resolve, 10000));
        // wait.then(() => {
        //   console.log("10 seconds passed");
        // });
    }
    // const t = await startCooldownFor("0xcE6fF2Ad12F4A27d490FEd5A42b0fDDEf164D6F5", "Tree", 0);
    // console.log("t", t);
}
testCooldownFor();
