import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCertificationLevels} from './certificationLabels';
test('expands verified categories and honestly labels unmatched source fragments',()=>{
  assert.equal(formatCertificationLevels('PLATINO','2'),'2× Platino');
  assert.equal(formatCertificationLevels('PLATINO & ORO','1 & 1'),'1× Platino + 1× Oro');
  assert.equal(formatCertificationLevels('PLATINO & ORO PLATINO & ORO','2 & 1'),'Nivel no verificado · 2 & 1');
  assert.equal(formatCertificationLevels('PLATINO','2x'),'Nivel no verificado · 2x');
  assert.equal(formatCertificationLevels('PLATINO & ORO','1 & x & 1'),'Nivel no verificado · 1 & x & 1');
  assert.equal(formatCertificationLevels('',''),'—');
});
