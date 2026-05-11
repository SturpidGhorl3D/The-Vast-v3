
import { TECHNOLOGIES } from '../../../components/game/technologyTypes';
import type { GameEngine } from '../GameEngine';

export class ResearchManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  /**
   * For the new dynamic system, we start with no available techs until the player innovates.
   */
  public rollInitialOptions() {
    this.rollInnovationChoices();
  }

  public update(dt: number) {
    const { player, ecs } = this.engine;
    if (player === null || !this.engine.activeResearch) return;

    let researchPower = 1.0 * dt; 
    const hull = ecs.getHull(player);
    if (hull) {
      const labs = hull.compartments?.filter((c: any) => c.type === 'RESEARCH').length || 0;
      researchPower += labs * 5 * dt; 
    }

    this.engine.activeResearch.progress += researchPower;
    if (this.engine.activeResearch.progress >= this.engine.activeResearch.totalCost) {
       this.finishResearch();
    }
  }


  /**
   * Spends Innovation Points to roll random technologies.
   * If baseTechId is provided, it's a deliberate branch-out from an existing node.
   * If not, it's a global innovation or automated end-of-branch roll.
   */
  public rollInnovationChoices(count: number = 2, baseTechId?: string, isFree: boolean = false) {
    const isStart = this.engine.researchedTechs.length === 0;
    
    // Calculate cost
    let cost = 0;
    if (!isStart && !isFree) {
      if (baseTechId) {
        // Exponential cost for branching from an existing node
        const branchCount = this.engine.techBranchingCounts[baseTechId] || 0;
        cost = Math.pow(2, branchCount);
      } else {
        // Global innovation cost
        cost = 1; 
      }
    }

    if (this.engine.innovationPoints < cost && !isStart && !isFree) return;
    
    const shipType = this.engine.playerSpecies?.shipType || 'STANDARD';
    
    // Find potential techs
    const potentialNext = Object.values(TECHNOLOGIES).filter(t => {
       const reqsMet = t.requirements.every(req => this.engine.researchedTechs.includes(req));
       const notResearched = !this.engine.researchedTechs.includes(t.id);
       const notAvailable = !this.engine.availableTechOptions.includes(t.id);
       const notPendingGlobal = !this.engine.pendingInnovationChoices.includes(t.id);
       const notPendingBranch = !Object.values(this.engine.pendingBranchChoices).some(list => list.includes(t.id));
       const shipMatch = !t.shipTypeRestriction || t.shipTypeRestriction.includes(shipType);
       
       if (baseTechId) {
         return reqsMet && notResearched && notAvailable && notPendingGlobal && notPendingBranch && shipMatch && t.requirements.includes(baseTechId);
       }
       return reqsMet && notResearched && notAvailable && notPendingGlobal && notPendingBranch && shipMatch;
    });

    if (potentialNext.length > 0) {
       if (!isStart) {
         this.engine.innovationPoints -= cost;
         if (baseTechId) {
           this.engine.techBranchingCounts[baseTechId] = (this.engine.techBranchingCounts[baseTechId] || 0) + 1;
         }
       }
       
       // Shuffle the whole pool first to avoid deterministic feel
       const shuffle = (array: any[]) => {
         for (let i = array.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [array[i], array[j]] = [array[j], array[i]];
         }
         return array;
       };

       const pool = shuffle([...potentialNext]);
       
       // Priority: if baseTechId is provided, we prefer descendants of that tech
       // but we fill up to 'count' using other potential techs if needed
       let choices: string[] = [];
       
       if (baseTechId) {
         const directDescendants = pool.filter(t => t.requirements.includes(baseTechId));
         const others = pool.filter(t => !t.requirements.includes(baseTechId));
         
         // Take up to count from direct descendants
         choices = directDescendants.slice(0, count).map(t => t.id);
         
         // If we need more, take from others
         if (choices.length < count) {
           const remainingCount = count - choices.length;
           choices = [...choices, ...others.slice(0, remainingCount).map(t => t.id)];
         }
       } else {
         // Global innovation: just take from the shuffled pool
         choices = pool.slice(0, count).map(t => t.id);
       }
       
       if (baseTechId) {
         this.engine.pendingBranchChoices[baseTechId] = [...(this.engine.pendingBranchChoices[baseTechId] || []), ...choices];
       } else {
         this.engine.pendingInnovationChoices = [...this.engine.pendingInnovationChoices, ...choices];
       }
       this.engine.saveState();
    }
  }

  public finishResearch() {
    if (!this.engine.activeResearch) return;

    const finishedTechId = this.engine.activeResearch.techId;
    if (!this.engine.researchedTechs.includes(finishedTechId)) {
      this.engine.researchedTechs.push(finishedTechId);
    }
    const finishedTech = TECHNOLOGIES[finishedTechId];
    this.engine.activeResearch = null;
    
    // Award innovation point
    this.engine.innovationPoints += 1;
    
    // Remove from available options
    this.engine.availableTechOptions = this.engine.availableTechOptions.filter(id => id !== finishedTechId);

    // Automated branching at the end of a branch
    // Check if this tech was a "dead end" in the available options for its category
    const hasExistingUnresearchedDescendants = Object.values(TECHNOLOGIES).some(t => 
      t.category === finishedTech.category && 
      t.requirements.includes(finishedTechId) && 
      (this.engine.researchedTechs.includes(t.id) || this.engine.availableTechOptions.includes(t.id))
    );

    if (!hasExistingUnresearchedDescendants) {
      // It's the current end of its branch, roll 2 new options for free
      this.rollInnovationChoices(2, finishedTechId, true);
    }

    this.engine.saveState(); 
  }

  public selectInnovationChoice(techId: string, parentId?: string) {
    if (parentId) {
      const choices = this.engine.pendingBranchChoices[parentId];
      if (!choices || !choices.includes(techId)) return;
      this.engine.availableTechOptions.push(techId);
      delete this.engine.pendingBranchChoices[parentId];
    } else {
      if (!this.engine.pendingInnovationChoices.includes(techId)) return;
      this.engine.availableTechOptions.push(techId);
      this.engine.pendingInnovationChoices = this.engine.pendingInnovationChoices.filter(id => id !== techId);
    }
    this.engine.saveState();
  }

  public branchOut(baseTechId: string) {
    this.rollInnovationChoices(2, baseTechId);
  }
}
