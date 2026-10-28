import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionEarning,calcCoachSalary} from '../src/crmLogic.js';
const coach={id:'pending-source-coach',grade:'pending'};
const done={id:'s',coachId:coach.id,status:'done',type:'promo',studentIds:['p'],attendance:{p:'present'},promoResults:{p:'bought'}};
test('Unconfirmed source category never produces an assumed ordinary/PRO salary',()=>{
  for(const type of ['promo','individual','group','sport_group']) {
    assert.equal(sessionEarning(coach,{...done,type}),null);
    const salary=calcCoachSalary(coach,[{...done,type}]);
    assert.equal(salary.total,null);assert.equal(salary.requiresGradeConfirmation,true);
    assert.equal(salary.totalSessions,1);
  }
  assert.equal(calcCoachSalary(coach,[]).total,null);
});
test('An explicit category confirmation calculates held sessions by existing rates',()=>{
  const declined={...done,promoResults:{p:'not_bought'}};
  assert.equal(sessionEarning({...coach,grade:'regular'},declined),300);
  assert.equal(sessionEarning({...coach,grade:'pro'},declined),400);
  assert.equal(sessionEarning({...coach,grade:'regular'},done),500);
  assert.equal(sessionEarning({...coach,grade:'pro'},done),500);
  assert.equal(sessionEarning(coach,{...done,status:'upcoming'}),0);
});
