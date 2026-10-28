import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestedSessionName,groupNameSuggestions} from '../src/sessionUi.js';

test('Promo and individual names include the selected direction without requiring a group name',()=>{
  for(const direction of ['Ролики','BMX','Скейт','Беговел','Велик','Самокат']){
    assert.equal(suggestedSessionName('promo',direction),`Промо · ${direction}`);
    assert.equal(suggestedSessionName('individual',direction),`Индивидуальная · ${direction}`);
  }
});
test('Group and sport names remain free input; unknown direction never invents a label',()=>{
  assert.equal(suggestedSessionName('group','Ролики'),'');
  assert.equal(suggestedSessionName('sport_group','Ролики'),'');
  assert.equal(suggestedSessionName('promo',null),'');
});
test('Group suggestions use only existing group/sport names in the selected branch and direction',()=>{
  const base={type:'group',branchId:'roza',discipline:'rollers'};
  const sessions=[{...base,groupName:'TEST Group'}, {...base,type:'sport_group',groupName:'TEST Sport'},
    {...base,groupName:'  TEST Group '}, {...base,groupName:' '}, {...base},
    {...base,type:'promo',groupName:'TEST Promo'}, {...base,type:'individual',groupName:'TEST Individual'},
    {...base,branchId:'irkutsk',groupName:'TEST Foreign Branch'}, {...base,discipline:'bmx',groupName:'TEST Other Direction'}];
  assert.deepEqual(groupNameSuggestions(sessions,{branchId:'roza',discipline:'rollers'}),['TEST Group','TEST Sport']);
});
test('Empty or role-scoped session lists never create suggestions from outside the supplied data',()=>{
  assert.deepEqual(groupNameSuggestions([],{branchId:'roza',discipline:'rollers'}),[]);
  const scoped=[{type:'group',branchId:'roza',discipline:'bmx',groupName:'TEST Own Group'}];
  assert.deepEqual(groupNameSuggestions(scoped,{branchId:'irkutsk',discipline:'bmx'}),[]);
});
